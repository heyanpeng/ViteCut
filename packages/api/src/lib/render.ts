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

const ffmpegBin = ffmpegPath;
if (typeof ffmpegBin !== "string" || !ffmpegBin) {
  throw new Error("ffmpeg-static binary not found");
}
ffmpeg.setFfmpegPath(ffmpegBin);

const OUTPUT_DIR = path.join(process.cwd(), "output");
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

/** 检查 asset.source 是否为 FFmpeg 可读取的 URL */
function isFfmpegReadableUrl(source: string): boolean {
  return (
    (source.startsWith("http://") || source.startsWith("https://")) &&
    source.length > 0
  );
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
        isFfmpegReadableUrl(asset.source)
      ) {
        const op: LayerOp = { type: "video", clip, asset, track };
        videoClips.push(op);
        layers.push(op);
      } else if (
        clip.kind === "image" &&
        asset.kind === "image" &&
        isFfmpegReadableUrl(asset.source)
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

  filterParts.push(`[0:v]copy[${lastLabel}]`);

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
      const clip = videoClips[0].clip;
      const asset = videoClips[0].asset;
      const inPoint = clip.inPoint ?? clip.start;
      const clipDuration = clip.end - clip.start;
      const scaleFilter = `scale=${outW}:${outH}:force_original_aspect_ratio=decrease,pad=${outW}:${outH}:(ow-iw)/2:(oh-ih)/2`;
      const gifFilter = `${scaleFilter},fps=${fps},split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse`;

      cmd = ffmpeg(asset.source)
        .setStartTime(inPoint)
        .setDuration(clipDuration)
        .outputOptions(["-vf", gifFilter, "-c:v", "gif", "-loop", "0"]);
    } else {
      cmd = ffmpeg();
      cmd
        .addInput(`color=c=black:s=${outW}x${outH}:d=${ff(duration)}:r=${fps}`)
        .inputOptions(["-f", "lavfi"]);
      if (inputVideo) cmd.addInput(inputVideo.asset.source);
      if (inputImage) cmd.addInput(inputImage.asset.source);

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
