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
const ffmpegBin =
  process.env.FFMPEG_PATH ??
  (typeof ffmpegPath === "string" ? ffmpegPath : null);
if (typeof ffmpegBin !== "string" || !ffmpegBin) {
  throw new Error(
    "FFmpeg binary not found. Set FFMPEG_PATH or ensure ffmpeg-static is installed."
  );
}
ffmpeg.setFfmpegPath(ffmpegBin);

const OUTPUT_DIR = path.join(process.cwd(), "output");
const UPLOADS_DIR = path.join(process.cwd(), "uploads");
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

/** 解析 asset.source 为 FFmpeg 可读取的路径或 URL */
function resolveAssetSource(source: string): string {
  if (source.startsWith("http://") || source.startsWith("https://")) {
    return source;
  }
  if (source.startsWith("/uploads/")) {
    const relPath = source.slice("/uploads/".length);
    return path.join(UPLOADS_DIR, relPath);
  }
  if (source.startsWith("uploads/")) {
    return path.join(UPLOADS_DIR, source.slice("uploads/".length));
  }
  return source;
}

/** 检查 asset.source 是否为 FFmpeg 可读取的（URL 或本地 uploads 路径） */
function isFfmpegReadableSource(source: string): boolean {
  if (source.startsWith("http://") || source.startsWith("https://"))
    return true;
  if (source.startsWith("/uploads/") || source.startsWith("uploads/"))
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
  const t = clip.transform as
    | { x?: number; y?: number; scaleX?: number; scaleY?: number }
    | undefined;
  const scaleX = t?.scaleX ?? 1;
  const scaleY = t?.scaleY ?? 1;
  const projX = t?.x ?? 0;
  const projY = t?.y ?? 0;

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

/** 转义 drawtext 的 text 参数 */
function escapeDrawtextText(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "'\\\\\\''")
    .replace(/\n/g, "\\n");
}

/** 限制小数位，避免 FFmpeg 解析超长浮点报错 */
function ff(v: number, decimals = 3): string {
  return Number(v.toFixed(decimals)).toString();
}

/** 1x1 黑色 PNG（base64），用于生成黑底，避免依赖 lavfi（Alpine ffmpeg 可能不含 lavfi） */
const BLACK_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

function ensureBlackPngPath(): string {
  const p = path.join(os.tmpdir(), "vitecut-black-1x1.png");
  if (!fs.existsSync(p)) {
    fs.writeFileSync(p, Buffer.from(BLACK_PNG_BASE64, "base64"));
  }
  return p;
}

/** 将 CSS 十六进制颜色 (#rgb 或 #rrggbb) 转为 FFmpeg drawbox 的 0xRRGGBB 格式 */
function hexToFfmpegColor(hex: string): string {
  let h = hex.replace(/^#/, "");
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  if (h.length !== 6 || !/^[0-9a-fA-F]{6}$/.test(h)) return "0x000000";
  return "0x" + h.toLowerCase();
}

/**
 * 多轨合成渲染：支持视频、图片、文本叠加。
 * 按 track.order 升序叠放（order 大的在上层）。
 */
export async function renderVideo(
  project: RenderProject,
  options: ExportOptions
): Promise<string> {
  const projW = project.width;
  const projH = project.height;
  const outW = options.width;
  const outH = options.height;
  const fps = options.fps || 30;
  const duration = project.duration;

  const tracksByOrder = [...project.tracks]
    .filter((t) => !t.hidden)
    .sort((a, b) => a.order - b.order);

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

  const layers: LayerOp[] = [];
  const videoClips: LayerOp[] = [];
  const imageClips: LayerOp[] = [];
  const textClips: LayerOp[] = [];

  for (const track of tracksByOrder) {
    for (const clip of track.clips) {
      const asset = project.assets.find((a) => a.id === clip.assetId);
      if (!asset) continue;

      if (
        clip.kind === "video" &&
        asset.kind === "video" &&
        isFfmpegReadableSource(asset.source)
      ) {
        const op: LayerOp = { type: "video", clip, asset, track };
        videoClips.push(op);
        layers.push(op);
      } else if (
        clip.kind === "image" &&
        asset.kind === "image" &&
        isFfmpegReadableSource(asset.source)
      ) {
        const op: LayerOp = { type: "image", clip, asset, track };
        imageClips.push(op);
        layers.push(op);
      } else if (clip.kind === "text" && asset.kind === "text") {
        const op: LayerOp = { type: "text", clip, asset, track };
        textClips.push(op);
        layers.push(op);
      }
    }
  }

  const ext =
    options.format === "mov" ? "mov" : options.format === "gif" ? "gif" : "mp4";
  const filename = `${options.title.replace(/\s+/g, "_")}_${randomUUID().slice(0, 8)}.${ext}`;
  const outputPath = path.join(OUTPUT_DIR, filename);
  const isGif = options.format === "gif";

  if (
    videoClips.length === 0 &&
    imageClips.length === 0 &&
    textClips.length === 0
  ) {
    throw new Error("工程中无可渲染的媒体（需 HTTP URL）或文本");
  }

  const inputVideo = videoClips[0];
  const inputImage = imageClips[0];

  const inputIndices = {
    video: inputVideo ? 1 : -1,
    image: inputImage ? (inputVideo ? 2 : 1) : -1,
  };

  const filterParts: string[] = [];
  let lastLabel = "base";

  // 使用 project.backgroundColor 作为画布底；无或黑色时直接 copy，否则用 drawbox 填色
  const bgHex = project.backgroundColor ?? "#000000";
  const ffmpegColor = hexToFfmpegColor(bgHex);
  const isBlack = ffmpegColor === "0x000000";
  // 1x1 黑图需先 scale 到输出尺寸；-vf 不能放 inputOptions（会被误当作 output 选项）
  filterParts.push(
    isBlack
      ? `[0:v]scale=${outW}:${outH}[${lastLabel}]`
      : `[0:v]scale=${outW}:${outH},drawbox=x=0:y=0:w=iw:h=ih:color=${ffmpegColor}@1:t=fill[${lastLabel}]`
  );

  for (const op of layers) {
    const { clip, asset } = op;

    if (op.type === "text") {
      const params = (clip.params ?? {}) as {
        text?: string;
        fontSize?: number;
        fill?: string;
      };
      const text =
        params.text ??
        (asset.textMeta as { initialText?: string })?.initialText ??
        "";
      if (!text) continue;

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
      const x = Math.round(((projX - anchorX) / projW) * outW);
      const y = Math.round(((projY - anchorY) / projH) * outH);
      const fontSize = Math.max(
        12,
        Math.round(((params.fontSize ?? 32) / projH) * outH)
      );
      const fill = params.fill ?? "#ffffff";
      const fontcolor = fill.startsWith("#")
        ? "0x" + fill.slice(1).toLowerCase()
        : "0xffffff";

      const fontPaths = [
        "/System/Library/Fonts/PingFang.ttc",
        "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc",
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
        "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
        "/Library/Fonts/Arial Unicode.ttf",
      ];
      const fontfile = fontPaths.find((p) => fs.existsSync(p));
      const fontOpt = fontfile
        ? `:fontfile='${fontfile.replace(/'/g, "'\\\\\\''")}'`
        : "";

      const textLabel = `txt${filterParts.length}`;
      filterParts.push(
        `[${lastLabel}]drawtext=text='${escapeDrawtextText(text)}':fontsize=${fontSize}:fontcolor=${fontcolor}:x=${x}:y=${y}${fontOpt}:enable='gte(t,${ff(clip.start)})*lte(t,${ff(clip.end)})'[${textLabel}]`
      );
      lastLabel = textLabel;
    } else if (op.type === "image") {
      const clipDuration = clip.end - clip.start;
      const rect = getOverlayRect(clip, asset, projW, projH, outW, outH);
      const imgLabel = `img${filterParts.length}`;
      const outLabel = `o${filterParts.length}`;

      filterParts.push(
        `[${inputIndices.image}:v]loop=-1:size=1:start=0,trim=0:${ff(clipDuration)},setpts=PTS-STARTPTS,fps=${fps},scale=${rect.w}:${rect.h}[${imgLabel}]`
      );
      filterParts.push(
        `[${lastLabel}][${imgLabel}]overlay=${rect.x}:${rect.y}:enable='gte(t,${ff(clip.start)})*lte(t,${ff(clip.end)})'[${outLabel}]`
      );
      lastLabel = outLabel;
    } else if (op.type === "video") {
      const inPoint = clip.inPoint ?? clip.start;
      const outPoint = clip.outPoint ?? clip.end;
      const scaleFilter = `scale=${outW}:${outH}:force_original_aspect_ratio=decrease,pad=${outW}:${outH}:(ow-iw)/2:(oh-ih)/2`;

      const vidLabel = `vid${filterParts.length}`;
      const outLabel = `o${filterParts.length}`;

      filterParts.push(
        `[${inputIndices.video}:v]trim=${ff(inPoint)}:${ff(outPoint)},setpts=PTS-STARTPTS,${scaleFilter}[${vidLabel}]`
      );
      filterParts.push(
        `[${lastLabel}][${vidLabel}]overlay=0:0:enable='gte(t,${ff(clip.start)})*lte(t,${ff(clip.end)})'[${outLabel}]`
      );
      lastLabel = outLabel;
    }
  }

  const filterComplex = filterParts.join(";");
  const filterScriptPath = path.join(
    os.tmpdir(),
    `vitecut-filter-${randomUUID()}.txt`
  );

  const isSimpleVideo =
    videoClips.length === 1 &&
    imageClips.length === 0 &&
    textClips.length === 0 &&
    videoClips[0].clip.start <= 0.01 &&
    videoClips[0].clip.end >= duration - 0.01;

  return new Promise((resolve, reject) => {
    let cmd: ReturnType<typeof ffmpeg>;

    if (isSimpleVideo && !isGif) {
      const clip = videoClips[0].clip;
      const asset = videoClips[0].asset;
      const inPoint = clip.inPoint ?? clip.start;
      const clipDuration = clip.end - clip.start;
      const scaleFilter = `scale=${outW}:${outH}:force_original_aspect_ratio=decrease,pad=${outW}:${outH}:(ow-iw)/2:(oh-ih)/2`;

      cmd = ffmpeg(resolveAssetSource(asset.source))
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
      const clip = videoClips[0].clip;
      const asset = videoClips[0].asset;
      const inPoint = clip.inPoint ?? clip.start;
      const clipDuration = clip.end - clip.start;
      const scaleFilter = `scale=${outW}:${outH}:force_original_aspect_ratio=decrease,pad=${outW}:${outH}:(ow-iw)/2:(oh-ih)/2`;
      const gifFilter = `${scaleFilter},fps=${fps},split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse`;

      cmd = ffmpeg(resolveAssetSource(asset.source))
        .setStartTime(inPoint)
        .setDuration(clipDuration)
        .outputOptions(["-vf", gifFilter, "-c:v", "gif", "-loop", "0"]);
    } else {
      cmd = ffmpeg();
      // 使用 1x1 黑图替代 lavfi color（Alpine ffmpeg 可能不含 lavfi）
      const blackPng = ensureBlackPngPath();
      cmd.addInput(blackPng).inputOptions([
        "-loop",
        "1",
        "-t",
        ff(duration),
        "-r",
        String(fps),
      ]);
      if (inputVideo) cmd.addInput(resolveAssetSource(inputVideo.asset.source));
      if (inputImage) cmd.addInput(resolveAssetSource(inputImage.asset.source));

      const audioInputIdx = inputVideo ? (inputImage ? 2 : 1) : -1;
      fs.writeFileSync(filterScriptPath, filterComplex, "utf-8");
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

    const isComplex = !isSimpleVideo;
    cmd
      .output(outputPath)
      .on("end", () => {
        if (isComplex) {
          try {
            fs.unlinkSync(filterScriptPath);
          } catch {
            /* ignore */
          }
        }
        resolve(`/output/${filename}`);
      })
      .on("error", (err) => {
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
