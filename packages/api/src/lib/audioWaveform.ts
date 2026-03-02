import path from "node:path";
import fs from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import ffmpegPath from "ffmpeg-static";

// 将 execFile 转为 Promise 形式，方便 async/await 调用
const execFileAsync = promisify(execFile);

// 获取 FFmpeg 可执行文件路径，支持通过环境变量 FFMPEG_PATH 覆盖
const ffmpegBin =
  process.env.FFMPEG_PATH ??
  (typeof ffmpegPath === "string" ? ffmpegPath : null);

/**
 * 使用 FFmpeg 为音频文件生成波形图(PNG图像)。
 * 依赖 ffmpeg-static 或环境变量 FFMPEG_PATH 指定 FFmpeg 路径。
 * 生成的波形图为灰色（#9ca3af），用于音频可视化封面等场景。
 *
 * @param audioPath   音频文件绝对路径
 * @param outputPath  输出的 PNG 文件路径
 * @param width       波形图宽度（像素），默认 120
 * @param height      波形图高度（像素），默认 40
 * @returns           成功返回 true，失败返回 false
 */
export async function generateWaveform(
  audioPath: string,
  outputPath: string,
  width = 120,
  height = 40
): Promise<boolean> {
  // 校验 FFmpeg 路径与音频文件是否存在
  if (!ffmpegBin || !fs.existsSync(audioPath)) {
    return false;
  }
  try {
    // 确保输出目录存在
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });

    // 调用 FFmpeg 生成波形图
    // -i audioPath 输入音频
    // -lavfi showwavespic 生成音频波形图片，颜色为 #9ca3af，尺寸为 width*height
    // -frames:v 1 只输出一帧
    // -y 自动覆盖输出文件
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

    // 如果输出文件存在，视为成功
    return fs.existsSync(outputPath);
  } catch {
    // 任意异常都返回 false
    return false;
  }
}
