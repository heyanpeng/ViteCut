import { getAuthHeaders } from "@/contexts";

/** 后端返回的媒体记录结构 */
export interface MediaUploadRecord {
  id: string;
  name: string;
  type: "video" | "image" | "audio";
  addedAt: number;
  url: string;
  filename: string;
  duration?: number;
}

/**
 * 上传文件到媒体库服务，返回可被后端 FFmpeg 访问的 HTTP URL。（需登录）
 */
export async function uploadFileToMedia(file: File): Promise<{ url: string }> {
  const { record } = await uploadFileToMediaWithProgress(file);
  return { url: record.url };
}

/**
 * 带进度的上传，用于媒体面板展示上传进度。
 * @param onProgress 0-100 的进度回调
 */
export function uploadFileToMediaWithProgress(
  file: File,
  onProgress?: (percent: number) => void
): Promise<{ url: string; record: MediaUploadRecord }> {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append("file", file, file.name);

    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const record = JSON.parse(xhr.responseText) as MediaUploadRecord;
          onProgress?.(100);
          resolve({ url: record.url, record });
        } catch {
          reject(new Error("响应解析失败"));
        }
      } else {
        try {
          const err = JSON.parse(xhr.responseText) as { error?: string };
          reject(new Error(err.error || `上传失败: ${xhr.status}`));
        } catch {
          reject(new Error(`上传失败: ${xhr.status}`));
        }
      }
    });

    xhr.addEventListener("error", () => reject(new Error("网络错误")));
    xhr.addEventListener("abort", () => reject(new Error("上传已取消")));
    xhr.addEventListener("timeout", () => reject(new Error("上传超时")));

    xhr.timeout = 60_000; // 60 秒
    xhr.open("POST", "/api/media");
    const authHeaders = getAuthHeaders();
    for (const [key, value] of Object.entries(authHeaders)) {
      xhr.setRequestHeader(key, value);
    }
    xhr.send(formData);
  });
}
