import path from "node:path";
import fs from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import ffmpegPath from "ffmpeg-static";

// 将 execFile 函数转为 Promise 形式，便于异步/await 使用
const execFileAsync = promisify(execFile);

// FFmpeg 二进制路径，优先读取 FFMPEG_PATH 环境变量，否则用依赖包提供路径
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
  // 检查 ffmpeg 可用、视频文件存在
  if (!ffmpegBin || !fs.existsSync(videoPath)) {
    return false;
  }
  try {
    // 保证输出目录存在
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    // 使用 -ss（seek到指定时间）和 -vframes 1 仅提取一帧。-vf 缩放宽度至320，等比缩放。
    await execFileAsync(ffmpegBin, [
      "-ss",
      String(timeOffset),
      "-i",
      videoPath,
      "-vframes",
      "1",
      "-vf",
      "scale=320:-1", // 宽度 320，高度等比例自适应，减小体积
      "-y",
      outputPath,
    ]);
    // 检查输出文件是否生成
    return fs.existsSync(outputPath);
  } catch {
    // 捕获异常（如短视频 seek 失败），若 timeOffset>0，则降级提取首帧
    if (timeOffset > 0) {
      try {
        // 无法 seek 时尝试直接截取首帧
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
        // 提取首帧也失败，返回 false
        return false;
      }
    }
    // timeOffset=0 已经降级到最低，直接失败
    return false;
  }
}

// 用于匹配 ffmpeg -i 输出的 Duration 行，如：Duration: 00:12:34.56,
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
  // 检查 ffmpeg 可用、视频文件存在
  if (!ffmpegBin || !fs.existsSync(videoPath)) {
    return undefined;
  }
  try {
    // -f null -：伪装输出避免 ffmpeg 因无输出而报错，核心目的是解析 stderr
    const { stderr } = await execFileAsync(
      ffmpegBin,
      ["-i", videoPath, "-f", "null", "-"],
      { encoding: "utf-8" }
    );
    // 提取 Duration 行的匹配内容
    const m = stderr.match(DURATION_REGEX);
    if (!m) return undefined;
    // 结构赋值各时间分量（小时、分、秒、小数）
    const [, h, min, sec, cs] = m;
    // 小数部分转为分数（n位数则除以10的n次），如“56”=>0.56
    const frac = parseInt(cs!, 10) / Math.pow(10, cs!.length);
    // 各分量转秒数相加获得总秒数
    const total =
      parseInt(h!, 10) * 3600 +
      parseInt(min!, 10) * 60 +
      parseInt(sec!, 10) +
      frac;
    // 若结果大于0返回（容错），否则 undefined
    return total > 0 ? total : undefined;
  } catch {
    // 任意异常返回 undefined
    return undefined;
  }
}
