import path from "node:path";
import fs from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import ffmpegPath from "ffmpeg-static";

const execFileAsync = promisify(execFile);

const ffmpegBin =
  process.env.FFMPEG_PATH ??
  (typeof ffmpegPath === "string" ? ffmpegPath : null);

/**
 * 使用 FFmpeg 为视频文件生成封面（截取指定时刻的一帧）。
 * @param videoPath 视频文件绝对路径
 * @param outputPath 输出 PNG 路径
 * @param timeOffset 截取时刻（秒），默认 0.5 避免首帧黑屏
 * @returns 成功返回 true，失败返回 false
 */
export async function generateVideoThumbnail(
  videoPath: string,
  outputPath: string,
  timeOffset = 0.5
): Promise<boolean> {
  if (!ffmpegBin || !fs.existsSync(videoPath)) {
    return false;
  }
  try {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    // -ss 放 -i 前可快速 seek，-vframes 1 只取一帧
    await execFileAsync(ffmpegBin, [
      "-ss",
      String(timeOffset),
      "-i",
      videoPath,
      "-vframes",
      "1",
      "-vf",
      "scale=320:-1", // 宽度 320，高度按比例，减小文件体积
      "-y",
      outputPath,
    ]);
    return fs.existsSync(outputPath);
  } catch {
    // 短视频可能无法 seek 到 0.5s，尝试首帧
    if (timeOffset > 0) {
      try {
        await execFileAsync(ffmpegBin, [
          "-i",
          videoPath,
          "-vframes",
          "1",
          "-vf",
          "scale=320:-1",
          "-y",
          outputPath,
        ]);
        return fs.existsSync(outputPath);
      } catch {
        return false;
      }
    }
    return false;
  }
}

const DURATION_REGEX = /Duration:\s*(\d{2}):(\d{2}):(\d{2})\.(\d+)/;

/**
 * 使用 FFmpeg 获取视频时长（秒）。
 * 通过 ffmpeg -i 的输出解析 Duration 行，无需 ffprobe。
 * @param videoPath 视频文件绝对路径
 * @returns 时长（秒），失败返回 undefined
 */
export async function getVideoDuration(
  videoPath: string
): Promise<number | undefined> {
  if (!ffmpegBin || !fs.existsSync(videoPath)) {
    return undefined;
  }
  try {
    // -f null - 让 ffmpeg 正常退出，否则会报错「未指定输出」
    const { stderr } = await execFileAsync(
      ffmpegBin,
      ["-i", videoPath, "-f", "null", "-"],
      { encoding: "utf-8" }
    );
    const m = stderr.match(DURATION_REGEX);
    if (!m) return undefined;
    const [, h, min, sec, cs] = m;
    const frac = parseInt(cs!, 10) / Math.pow(10, cs!.length);
    const total =
      parseInt(h!, 10) * 3600 +
      parseInt(min!, 10) * 60 +
      parseInt(sec!, 10) +
      frac;
    return total > 0 ? total : undefined;
  } catch {
    return undefined;
  }
}
