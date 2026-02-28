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
 * 使用 FFmpeg 为音频文件生成波形图。
 * @param audioPath 音频文件绝对路径
 * @param outputPath 输出 PNG 路径
 * @param width 宽度，默认 120
 * @param height 高度，默认 40
 * @returns 成功返回 true，失败返回 false
 */
export async function generateWaveform(
  audioPath: string,
  outputPath: string,
  width = 120,
  height = 40
): Promise<boolean> {
  if (!ffmpegBin || !fs.existsSync(audioPath)) {
    return false;
  }
  try {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    await execFileAsync(ffmpegBin, [
      "-i",
      audioPath,
      "-lavfi",
      `showwavespic=s=${width}x${height}:colors=0x9ca3af`,
      "-frames:v",
      "1",
      "-y",
      outputPath,
    ]);
    return fs.existsSync(outputPath);
  } catch {
    return false;
  }
}
