import { getAuthHeaders } from "@/contexts";
import type { MediaMeta } from "@/api/mediaApi";
import { decodeAudioToPeaks, drawWaveformToDataUrl } from "@/utils/audioWaveform";

/**
 * 后端返回的媒体记录结构
 * 表示一次媒体文件上传后返回的媒体元数据
 */
export interface MediaUploadRecord {
  id: string; // 媒体记录唯一ID
  name: string; // 用户原始文件名
  type: "video" | "image" | "audio"; // 媒体类型
  addedAt: number; // 添加时间戳
  url: string; // 可访问媒体url
  filename: string; // 存储介质上的文件名
  duration?: number; // 媒体时长（可选，仅音视频）
  meta?: MediaMeta; // 媒体扩展元信息
}

/**
 * 上传签名URL接口的返回结构
 * 用于前端直传到云存储
 */
interface SignedUploadResponse {
  driver: "oss"; // 云存储驱动
  method: "PUT"; // 请求方法
  uploadUrl: string; // 已签名上传url
  objectKey: string; // 对象键（文件唯一标识）
  publicUrl: string; // 上传后可公开访问url
  expiresAt: number; // url过期时间（毫秒）
  headers?: Record<string, string>; // 上传建议使用的自定义请求头
  mediaType: "video" | "image" | "audio"; // 媒体类型（与文件/后缀推断）
}

/**
 * 根据文件类型/扩展名推断媒体类型
 */
function inferTypeFromFile(file: File): "video" | "image" | "audio" {
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("audio/")) return "audio";
  const name = file.name.toLowerCase();
  // 常见视频扩展名
  if (/\.(mp4|webm|mov|avi|mkv)$/.test(name)) return "video";
  // 常见图片扩展名
  if (/\.(jpg|jpeg|png|gif|webp|bmp)$/.test(name)) return "image";
  // 常见音频扩展名
  if (/\.(mp3|wav|aac|ogg|flac|m4a)$/.test(name)) return "audio";
  // 默认为视频类型
  return "video";
}

/**
 * 向后端请求获取该文件的 OSS 签名上传URL与参数
 */
async function createSignedUpload(file: File): Promise<SignedUploadResponse> {
  const res = await fetch("/api/storage/upload-url", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify({
      filename: file.name, // 文件名
      contentType: file.type || "application/octet-stream", // mime类型
      type: inferTypeFromFile(file), // 媒体类型
    }),
  });
  if (!res.ok) {
    // 返回异常时处理后端错误
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error || `创建签名上传失败: ${res.status}`);
  }
  return res.json();
}

/**
 * 通知后端“上传已完成”，要求记录该媒体（如要入库或补充元信息）。
 * @param params - 媒体对象关键信息（包含objectKey，与signed信息一致）
 */
async function completeMediaRecord(params: {
  objectKey: string;
  url: string;
  name: string;
  type: "video" | "image" | "audio";
  mimetype?: string;
  duration?: number;
  coverUrl?: string;
  meta?: MediaMeta;
}): Promise<MediaUploadRecord> {
  const res = await fetch("/api/media/complete", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error || `入库失败: ${res.status}`);
  }
  return res.json();
}

/**
 * 读取视频时长并截取封面图（PNG）。
 * 若任一步骤失败，会返回已拿到的部分信息，避免影响主上传流程。
 */
async function extractVideoMetadata(file: File): Promise<{
  duration?: number;
  width?: number;
  height?: number;
  coverFile?: File;
}> {
  const objectUrl = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.preload = "metadata";
  video.muted = true;
  video.playsInline = true;

  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("读取视频元数据失败"));
      video.src = objectUrl;
    });

    const duration =
      Number.isFinite(video.duration) && video.duration > 0
        ? video.duration
        : undefined;
    const width = video.videoWidth > 0 ? video.videoWidth : undefined;
    const height = video.videoHeight > 0 ? video.videoHeight : undefined;
    if (!duration || !width || !height) {
      return { duration, width, height };
    }

    // 取前 10% 的画面作为封面，避免 0 秒黑屏。
    const seekTime = Math.min(Math.max(duration * 0.1, 0.1), Math.max(duration - 0.1, 0));
    await new Promise<void>((resolve, reject) => {
      video.onseeked = () => resolve();
      video.onerror = () => reject(new Error("视频定位失败"));
      video.currentTime = seekTime;
    });

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return { duration };
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((result) => resolve(result), "image/png");
    });
    if (!blob) return { duration };

    const baseName = file.name.replace(/\.[^.]+$/, "") || "video";
    const coverFile = new File([blob], `${baseName}_cover.png`, {
      type: "image/png",
    });
    return { duration, width, height, coverFile };
  } catch {
    return {};
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/**
 * 读取音频时长。失败时返回 undefined。
 */
async function extractAudioDuration(file: File): Promise<number | undefined> {
  const objectUrl = URL.createObjectURL(file);
  const audio = document.createElement("audio");
  audio.preload = "metadata";
  try {
    await new Promise<void>((resolve, reject) => {
      audio.onloadedmetadata = () => resolve();
      audio.onerror = () => reject(new Error("读取音频元数据失败"));
      audio.src = objectUrl;
    });
    if (Number.isFinite(audio.duration) && audio.duration > 0) {
      return audio.duration;
    }
    return undefined;
  } catch {
    return undefined;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/**
 * 为音频生成波形封面文件（PNG）。
 * 失败时返回 undefined，不影响主上传流程。
 */
async function createAudioWaveformCoverFile(
  file: File
): Promise<File | undefined> {
  try {
    const peaks = await decodeAudioToPeaks(file, 512);
    const dataUrl = drawWaveformToDataUrl(peaks, 120, 40);
    if (!dataUrl) {
      return undefined;
    }
    const blob = await fetch(dataUrl).then((res) => res.blob());
    if (!blob || blob.size <= 0) {
      return undefined;
    }
    const baseName = file.name.replace(/\.[^.]+$/, "") || "audio";
    return new File([blob], `${baseName}_waveform.png`, {
      type: "image/png",
    });
  } catch {
    return undefined;
  }
}

/**
 * 读取图片宽高。失败时返回 undefined。
 */
async function extractImageMetadata(file: File): Promise<{
  width: number;
  height: number;
} | null> {
  const objectUrl = URL.createObjectURL(file);
  const img = new Image();
  try {
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("读取图片元数据失败"));
      img.src = objectUrl;
    });
    const width = Math.max(1, img.naturalWidth || 0);
    const height = Math.max(1, img.naturalHeight || 0);
    return { width, height };
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/**
 * 实际执行将文件PUT到得到的签名uploadUrl
 * 支持进度回调。
 * @param file - 要上传的文件
 * @param signed - 签名上传信息
 * @param onProgress - 可选，上传进度回调（数字0-90之间）
 */
function putToSignedUrl(
  file: File,
  signed: SignedUploadResponse,
  onProgress?: (percent: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    // 上传进度处理，最多到90%
    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 90));
      }
    });

    // 上传完成（200-299为成功，其余失败）
    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`上传 OSS 失败: ${xhr.status}`));
      }
    });
    // 网络错误/中止/超时三种异常情况
    xhr.addEventListener("error", () => reject(new Error("网络错误")));
    xhr.addEventListener("abort", () => reject(new Error("上传已取消")));
    xhr.addEventListener("timeout", () => reject(new Error("上传超时")));

    xhr.timeout = 60_000; // 60s超时时间
    xhr.open(signed.method, signed.uploadUrl);
    // 不主动设置 Content-Type：OSS 该签名按“空 Content-Type”计算。
    // 若浏览器自动附带 image/jpeg 等类型，会触发 SignatureDoesNotMatch。
    // 这里发送 ArrayBuffer，避免 File/Blob 自动携带 Content-Type。
    file
      .arrayBuffer()
      .then((buffer) => {
        xhr.send(buffer);
      })
      .catch(() => {
        reject(new Error("读取文件内容失败"));
      });
  });
}

/**
 * 上传文件到媒体库服务，返回可被后端 FFmpeg 访问的 HTTP URL。（需登录）
 * 仅返回文件url，不包含详细媒体信息
 */
export async function uploadFileToMedia(
  file: File
): Promise<{ url: string; record: MediaUploadRecord }> {
  const { record } = await uploadFileToMediaWithProgress(file); // 内部带媒体入库及进度
  return { url: record.url, record }; // 返回最终文件url与完整记录
}

/**
 * 带进度的上传，用于媒体面板展示上传进度。
 * 包装完整上传-入库流程。进度0-100
 * @param file - 要上传的文件
 * @param onProgress 0-100 的进度回调
 * @returns 包含最终url和完整媒体记录
 */
export function uploadFileToMediaWithProgress(
  file: File,
  onProgress?: (percent: number) => void
): Promise<{ url: string; record: MediaUploadRecord }> {
  return (async () => {
    // 第一步：申请签名直传url
    const signed = await createSignedUpload(file);
    // 第二步：实际文件上传，为异步并带进度
    await putToSignedUrl(file, signed, onProgress);
    onProgress?.(92); // 主文件上传完成，进入元数据阶段

    // 浏览器侧优先提取媒体元数据：视频时长+封面、音频时长。
    let duration: number | undefined;
    let coverUrl: string | undefined;
    const meta: MediaMeta = {
      common: {
        mimeType: file.type || undefined,
        sizeBytes: file.size,
      },
    };
    if (signed.mediaType === "video") {
      const {
        duration: videoDuration,
        width: videoWidth,
        height: videoHeight,
        coverFile,
      } = await extractVideoMetadata(file);
      duration = videoDuration;
      meta.video = {
        ...(videoDuration != null ? { duration: videoDuration } : {}),
        ...(videoWidth != null ? { width: videoWidth } : {}),
        ...(videoHeight != null ? { height: videoHeight } : {}),
      };
      if (coverFile) {
        const coverSigned = await createSignedUpload(coverFile);
        await putToSignedUrl(coverFile, coverSigned);
        coverUrl = coverSigned.publicUrl;
      }
    } else if (signed.mediaType === "audio") {
      duration = await extractAudioDuration(file);
      meta.audio = {
        ...(duration != null ? { duration } : {}),
      };
      // 前端优先生成音频波形封面，避免后端兜底生成导致完成阶段阻塞。
      const waveformCoverFile = await createAudioWaveformCoverFile(file);
      if (waveformCoverFile) {
        const coverSigned = await createSignedUpload(waveformCoverFile);
        await putToSignedUrl(waveformCoverFile, coverSigned);
        coverUrl = coverSigned.publicUrl;
      }
    } else if (signed.mediaType === "image") {
      const imageMeta = await extractImageMetadata(file);
      if (imageMeta) {
        meta.image = imageMeta;
      }
    }
    onProgress?.(96);

    // 第三步：通知后端入库，完善媒体信息
    const record = await completeMediaRecord({
      objectKey: signed.objectKey,
      url: signed.publicUrl,
      name: file.name,
      type: signed.mediaType,
      mimetype: file.type || undefined,
      duration,
      coverUrl,
      meta,
    });
    onProgress?.(100); // 完全结束
    return { url: record.url, record };
  })();
}
