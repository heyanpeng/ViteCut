import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { randomUUID } from "node:crypto";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import type {
  RenderProject,
  RenderTrack,
  RenderAsset,
  RenderClip,
  ExportOptions,
} from "../types.js";

// 优先使用 FFMPEG_PATH（Docker 中通过 apk 安装的系统 ffmpeg），否则使用 ffmpeg-static
const envFfmpegPath = process.env.FFMPEG_PATH;
const staticFfmpegPath = typeof ffmpegPath === "string" ? ffmpegPath : null;
const ffmpegBin =
  (envFfmpegPath && fs.existsSync(envFfmpegPath) ? envFfmpegPath : null) ??
  (staticFfmpegPath && fs.existsSync(staticFfmpegPath) ? staticFfmpegPath : null) ??
  "ffmpeg";
ffmpeg.setFfmpegPath(ffmpegBin);

// 输出目录，所有渲染文件输出在此
const OUTPUT_DIR = path.join(process.cwd(), "output");
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

/** 检查 asset.source 是否为 FFmpeg 可读取的（仅支持 URL） */
function isFfmpegReadableSource(source: string): boolean {
  // 这里只支持 http/https 的网络资源，不支持本地文件
  if (source.startsWith("http://") || source.startsWith("https://"))
    return true;
  return false;
}

/** 解析 transform，计算 overlay 的 x, y, w, h（导出分辨率下） */
function getOverlayRect(
  clip: RenderClip,
  asset: RenderAsset,
  projW: number,
  projH: number,
  outW: number,
  outH: number
): { x: number; y: number; w: number; h: number } {
  // 取出变换参数
  const t = clip.transform as
    | { x?: number; y?: number; scaleX?: number; scaleY?: number }
    | undefined;
  const scaleX = t?.scaleX ?? 1;
  const scaleY = t?.scaleY ?? 1;
  const projX = t?.x ?? 0;
  const projY = t?.y ?? 0;

  // 按工程尺寸计算缩放、位移后的目标区域
  const w = projW * Math.abs(scaleX);
  const h = projH * Math.abs(scaleY);
  const outX = (projX / projW) * outW;
  const outY = (projY / projH) * outH;
  const outW2 = (w / projW) * outW;
  const outH2 = (h / projH) * outH;

  return {
    x: Math.round(outX),
    y: Math.round(outY),
    w: Math.round(outW2),
    h: Math.round(outH2),
  };
}

/** 转义 drawtext 的 text 参数，使其安全内嵌于 FFmpeg 命令 */
function escapeDrawtextText(s: string): string {
  // 替换反斜杠与单引号，并处理换行
  return s
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "'\\\\\\''")
    .replace(/\n/g, "\\n");
}

/** 限制小数位，避免 FFmpeg 解析超长浮点报错 */
function ff(v: number, decimals = 3): string {
  // 转字符串保留指定小数位
  return Number(v.toFixed(decimals)).toString();
}

/** 1x1 黑色 PNG（base64），用于生成黑底，避免依赖 lavfi（Alpine ffmpeg 可能不含 lavfi） */
const BLACK_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

/**
 * 确保本地有 1x1 黑色 PNG 文件，若无则生成
 * @returns 1x1 黑 PNG 路径
 */
function ensureBlackPngPath(): string {
  const p = path.join(os.tmpdir(), "vitecut-black-1x1.png");
  if (!fs.existsSync(p)) {
    fs.writeFileSync(p, Buffer.from(BLACK_PNG_BASE64, "base64"));
  }
  return p;
}

/** 将 CSS 十六进制颜色 (#rgb 或 #rrggbb) 转为 FFmpeg drawbox 的 0xRRGGBB 格式 */
function hexToFfmpegColor(hex: string): string {
  // 将3位色转为6位色，非法自动为黑色
  let h = hex.replace(/^#/, "");
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  if (h.length !== 6 || !/^[0-9a-fA-F]{6}$/.test(h)) return "0x000000";
  return "0x" + h.toLowerCase();
}

/**
 * 多轨合成渲染：支持视频、图片、文本叠加。
 * track.order 越大越上层，按升序叠放。
 */
export async function renderVideo(
  project: RenderProject,
  options: ExportOptions
): Promise<string> {
  // 项目基础参数
  const projW = project.width;
  const projH = project.height;
  const outW = options.width;
  const outH = options.height;
  const fps = options.fps || 30;
  const duration = project.duration;

  // tracks 排序，剔除隐藏轨道
  const tracksByOrder = [...project.tracks]
    .filter((t) => !t.hidden)
    .sort((a, b) => a.order - b.order);

  // 每一层的操作类型
  type LayerOp =
    | {
        type: "video";
        clip: RenderClip;
        asset: RenderAsset;
        track: RenderTrack;
      }
    | {
        type: "image";
        clip: RenderClip;
        asset: RenderAsset;
        track: RenderTrack;
      }
    | {
        type: "text";
        clip: RenderClip;
        asset: RenderAsset;
        track: RenderTrack;
      };

  // 轨道媒体分组
  const layers: LayerOp[] = [];
  const videoClips: LayerOp[] = [];
  const imageClips: LayerOp[] = [];
  const textClips: LayerOp[] = [];

  // 遍历所有轨道的片段，并按类型分组
  for (const track of tracksByOrder) {
    for (const clip of track.clips) {
      const asset = project.assets.find((a) => a.id === clip.assetId);
      if (!asset) continue; // 无媒资跳过

      if (
        clip.kind === "video" &&
        asset.kind === "video" &&
        isFfmpegReadableSource(asset.source)
      ) {
        // 视频片段
        const op: LayerOp = { type: "video", clip, asset, track };
        videoClips.push(op);
        layers.push(op);
      } else if (
        clip.kind === "image" &&
        asset.kind === "image" &&
        isFfmpegReadableSource(asset.source)
      ) {
        // 图片片段
        const op: LayerOp = { type: "image", clip, asset, track };
        imageClips.push(op);
        layers.push(op);
      } else if (clip.kind === "text" && asset.kind === "text") {
        // 文本片段
        const op: LayerOp = { type: "text", clip, asset, track };
        textClips.push(op);
        layers.push(op);
      }
    }
  }

  // 根据导出格式决定输出扩展名
  const ext =
    options.format === "mov" ? "mov" : options.format === "gif" ? "gif" : "mp4";
  // 渲染输出文件名，含项目 title 前缀 + uuid
  const filename = `${options.title.replace(/\s+/g, "_")}_${randomUUID().slice(0, 8)}.${ext}`;
  const outputPath = path.join(OUTPUT_DIR, filename);
  const isGif = options.format === "gif";

  // 没有任何合法可渲染媒体时给出明确报错
  if (
    videoClips.length === 0 &&
    imageClips.length === 0 &&
    textClips.length === 0
  ) {
    throw new Error("工程中无可渲染的媒体（需 HTTP URL）或文本");
  }

  // 只取第一个视频和图片作为 ffmpeg 输入序号引用
  const inputVideo = videoClips[0];
  const inputImage = imageClips[0];

  // 输入流下标（ffmpeg 输入序号），后续过滤引用用
  const inputIndices = {
    video: inputVideo ? 1 : -1,
    image: inputImage ? (inputVideo ? 2 : 1) : -1,
  };

  // 复杂滤镜脚本片段累加
  const filterParts: string[] = [];
  let lastLabel = "base";

  // 使用 project.backgroundColor 作为画布底；无或黑色时直接 copy，否则用 drawbox 填色
  const bgHex = project.backgroundColor ?? "#000000";
  const ffmpegColor = hexToFfmpegColor(bgHex);
  const isBlack = ffmpegColor === "0x000000";
  // 1x1 黑图需先 scale 到输出尺寸
  filterParts.push(
    isBlack
      ? `[0:v]scale=${outW}:${outH}[${lastLabel}]`
      : `[0:v]scale=${outW}:${outH},drawbox=x=0:y=0:w=iw:h=ih:color=${ffmpegColor}@1:t=fill[${lastLabel}]`
  );

  // 按层叠加处理文本、图片、视频
  for (const op of layers) {
    const { clip, asset } = op;

    if (op.type === "text") {
      // 文本层，提取文本内容、样式等
      const params = (clip.params ?? {}) as {
        text?: string;
        fontSize?: number;
        fill?: string;
      };
      const text =
        params.text ??
        (asset.textMeta as { initialText?: string })?.initialText ??
        "";
      if (!text) continue; // 没文本内容跳过

      // 解析文本 transform 参数
      const t = clip.transform as
        | {
            x?: number;
            y?: number;
            anchorX?: number;
            anchorY?: number;
          }
        | undefined;
      const projX = t?.x ?? 0;
      const projY = t?.y ?? 0;
      const anchorX = t?.anchorX ?? 0;
      const anchorY = t?.anchorY ?? 0;

      // 按比例换算导出尺寸的 xy 坐标
      const x = Math.round(((projX - anchorX) / projW) * outW);
      const y = Math.round(((projY - anchorY) / projH) * outH);

      // 字号按导出尺寸自适应比例，最小12
      const fontSize = Math.max(
        12,
        Math.round(((params.fontSize ?? 32) / projH) * outH)
      );

      // 填充色
      const fill = params.fill ?? "#ffffff";
      const fontcolor = fill.startsWith("#")
        ? "0x" + fill.slice(1).toLowerCase()
        : "0xffffff";

      // 常用中文字体路径集合，自动判断本地存在的ttc
      const fontPaths = [
        "/System/Library/Fonts/PingFang.ttc",
        "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc",
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
        "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
        "/Library/Fonts/Arial Unicode.ttf",
      ];
      // 选第一个存在的字体文件用于ffmpeg
      const fontfile = fontPaths.find((p) => fs.existsSync(p));
      const fontOpt = fontfile
        ? `:fontfile='${fontfile.replace(/'/g, "'\\\\\\''")}'`
        : "";

      // 滤镜标签
      const textLabel = `txt${filterParts.length}`;
      // ffmpeg drawtext 滤镜命令，enable控制出现时间
      filterParts.push(
        `[${lastLabel}]drawtext=text='${escapeDrawtextText(text)}':fontsize=${fontSize}:fontcolor=${fontcolor}:x=${x}:y=${y}${fontOpt}:enable='gte(t,${ff(clip.start)})*lte(t,${ff(clip.end)})'[${textLabel}]`
      );
      lastLabel = textLabel;
    } else if (op.type === "image") {
      // 图片层覆盖处理
      const clipDuration = clip.end - clip.start;
      const rect = getOverlayRect(clip, asset, projW, projH, outW, outH);
      const imgLabel = `img${filterParts.length}`;
      const outLabel = `o${filterParts.length}`;

      // 图片先loop补帧，trim对齐出现时长，scale缩放
      filterParts.push(
        `[${inputIndices.image}:v]loop=-1:size=1:start=0,trim=0:${ff(clipDuration)},setpts=PTS-STARTPTS,fps=${fps},scale=${rect.w}:${rect.h}[${imgLabel}]`
      );
      // overlay 合成到叠底
      filterParts.push(
        `[${lastLabel}][${imgLabel}]overlay=${rect.x}:${rect.y}:enable='gte(t,${ff(clip.start)})*lte(t,${ff(clip.end)})'[${outLabel}]`
      );
      lastLabel = outLabel;
    } else if (op.type === "video") {
      // 视频层处理（可做in/out裁剪和缩放）
      const inPoint = clip.inPoint ?? clip.start;
      const outPoint = clip.outPoint ?? clip.end;
      // 缩放并保持画面居中
      const scaleFilter = `scale=${outW}:${outH}:force_original_aspect_ratio=decrease,pad=${outW}:${outH}:(ow-iw)/2:(oh-ih)/2`;

      const vidLabel = `vid${filterParts.length}`;
      const outLabel = `o${filterParts.length}`;

      // 视频裁剪trim，reset pts，缩放
      filterParts.push(
        `[${inputIndices.video}:v]trim=${ff(inPoint)}:${ff(outPoint)},setpts=PTS-STARTPTS,${scaleFilter}[${vidLabel}]`
      );
      // overlay 合成到上一层
      filterParts.push(
        `[${lastLabel}][${vidLabel}]overlay=0:0:enable='gte(t,${ff(clip.start)})*lte(t,${ff(clip.end)})'[${outLabel}]`
      );
      lastLabel = outLabel;
    }
  }

  // 合成全部滤镜字符串
  const filterComplex = filterParts.join(";");
  // 临时生成的filter脚本路径
  const filterScriptPath = path.join(
    os.tmpdir(),
    `vitecut-filter-${randomUUID()}.txt`
  );

  // 简单情形：只有一个视频且恰好占满整个项目时可不走复杂滤镜
  const isSimpleVideo =
    videoClips.length === 1 &&
    imageClips.length === 0 &&
    textClips.length === 0 &&
    videoClips[0].clip.start <= 0.01 &&
    videoClips[0].clip.end >= duration - 0.01;

  return new Promise((resolve, reject) => {
    let cmd: ReturnType<typeof ffmpeg>;

    if (isSimpleVideo && !isGif) {
      // 快速路径：仅简单视频直接裁切导出（不走复杂脚本）
      const clip = videoClips[0].clip;
      const asset = videoClips[0].asset;
      const inPoint = clip.inPoint ?? clip.start;
      const clipDuration = clip.end - clip.start;
      const scaleFilter = `scale=${outW}:${outH}:force_original_aspect_ratio=decrease,pad=${outW}:${outH}:(ow-iw)/2:(oh-ih)/2`;

      cmd = ffmpeg(asset.source)
        .setStartTime(inPoint)
        .setDuration(clipDuration)
        .outputOptions(["-vf", scaleFilter])
        .outputOptions([
          "-c:v",
          options.videoCodec === "hevc" ? "libx265" : "libx264",
          "-b:v",
          `${options.videoBitrateKbps}k`,
          "-r",
          String(fps),
          "-movflags",
          "+faststart",
        ])
        .outputOptions(
          options.audioCodec === "pcm"
            ? ["-c:a", "pcm_s16le", "-ar", String(options.audioSampleRate)]
            : [
                "-c:a",
                "aac",
                "-b:a",
                `${options.audioBitrateKbps}k`,
                "-ar",
                String(options.audioSampleRate),
              ]
        );
    } else if (isSimpleVideo && isGif) {
      // 简单情形：单视频导出gif（额外带palette）
      const clip = videoClips[0].clip;
      const asset = videoClips[0].asset;
      const inPoint = clip.inPoint ?? clip.start;
      const clipDuration = clip.end - clip.start;
      const scaleFilter = `scale=${outW}:${outH}:force_original_aspect_ratio=decrease,pad=${outW}:${outH}:(ow-iw)/2:(oh-ih)/2`;
      // GIF palette循环方案
      const gifFilter = `${scaleFilter},fps=${fps},split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse`;

      cmd = ffmpeg(asset.source)
        .setStartTime(inPoint)
        .setDuration(clipDuration)
        .outputOptions(["-vf", gifFilter, "-c:v", "gif", "-loop", "0"]);
    } else {
      // 复杂合成路径
      cmd = ffmpeg();
      // 第一个输入：1x1 黑底图片
      const blackPng = ensureBlackPngPath();
      cmd
        .addInput(blackPng)
        .inputOptions(["-loop", "1", "-t", ff(duration), "-r", String(fps)]);
      // 依次添加需要的输入（视频/图片）
      if (inputVideo) cmd.addInput(inputVideo.asset.source);
      if (inputImage) cmd.addInput(inputImage.asset.source);

      // 视频存在则下一输入序号为音频源
      const audioInputIdx = inputVideo ? (inputImage ? 2 : 1) : -1;

      // 将复杂 filter 写入临时 txt 文件，用于 filter_complex_script
      fs.writeFileSync(filterScriptPath, filterComplex, "utf-8");
      // 输出选项组装
      const outputOpts = [
        "-filter_complex_script",
        filterScriptPath,
        "-map",
        `[${lastLabel}]`,
        "-t",
        ff(duration),
        ...(audioInputIdx >= 0 ? ["-map", `${audioInputIdx}:a?`] : []),
      ];

      cmd = cmd
        .outputOptions(outputOpts)
        .outputOptions([
          "-c:v",
          options.videoCodec === "hevc" ? "libx265" : "libx264",
          "-b:v",
          `${options.videoBitrateKbps}k`,
          "-r",
          String(fps),
          "-movflags",
          "+faststart",
        ])
        .outputOptions(
          options.audioCodec === "pcm"
            ? ["-c:a", "pcm_s16le", "-ar", String(options.audioSampleRate)]
            : [
                "-c:a",
                "aac",
                "-b:a",
                `${options.audioBitrateKbps}k`,
                "-ar",
                String(options.audioSampleRate),
              ]
        );
    }

    // 判断是否为复杂脚本路径
    const isComplex = !isSimpleVideo;
    cmd
      .output(outputPath)
      .on("end", () => {
        // 渲染完成后删除临时滤镜脚本
        if (isComplex) {
          try {
            fs.unlinkSync(filterScriptPath);
          } catch {
            /* ignore */
          }
        }
        resolve(outputPath);
      })
      .on("error", (err) => {
        // 错误清理临时文件
        if (isComplex) {
          try {
            fs.unlinkSync(filterScriptPath);
          } catch {
            /* ignore */
          }
        }
        reject(err);
      })
      .run();
  });
}
