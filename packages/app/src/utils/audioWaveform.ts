export type WaveformPeaks = number[];

/** 从音频 Blob 解码出简化波形峰值数组 */
export async function decodeAudioToPeaks(
  blob: Blob,
  targetCount = 512
): Promise<WaveformPeaks> {
  if (
    typeof window === "undefined" ||
    typeof OfflineAudioContext === "undefined"
  ) {
    return [];
  }

  const arrayBuffer = await blob.arrayBuffer();
  const audioContext = new OfflineAudioContext(1, 1, 44100);
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

  const channels = audioBuffer.numberOfChannels;
  const totalSamples = audioBuffer.length;
  const count = Math.min(targetCount, totalSamples || targetCount);
  const samplesPerPeak = Math.max(1, Math.floor(totalSamples / count));

  const channelDataArrays: Float32Array[] = [];
  for (let ch = 0; ch < channels; ch++) {
    channelDataArrays.push(audioBuffer.getChannelData(ch));
  }

  const peaks: number[] = new Array(count);
  for (let i = 0; i < count; i++) {
    let max = 0;
    const offset = i * samplesPerPeak;
    for (let j = 0; j < samplesPerPeak; j++) {
      for (let ch = 0; ch < channels; ch++) {
        const sample = channelDataArrays[ch]?.[offset + j] ?? 0;
        const abs = Math.abs(sample);
        if (abs > max) {
          max = abs;
        }
      }
    }
    peaks[i] = max;
  }

  // 归一化到 [0, 1]
  let globalMax = 0;
  for (let i = 0; i < count; i++) {
    const p = peaks[i] ?? 0;
    if (p > globalMax) {
      globalMax = p;
    }
  }
  if (globalMax > 0) {
    for (let i = 0; i < count; i++) {
      peaks[i] = (peaks[i] ?? 0) / globalMax;
    }
  }

  return peaks;
}

/** 将波形峰值绘制到离屏 canvas，返回 dataURL 作为缩略图 */
export function drawWaveformToDataUrl(
  peaks: WaveformPeaks,
  width = 120,
  height = 40,
  color = "#9ca3af",
  background = "transparent"
): string | undefined {
  if (typeof document === "undefined") return undefined;
  if (!peaks.length || width <= 0 || height <= 0) return undefined;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return undefined;

  if (background !== "transparent") {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);
  } else {
    ctx.clearRect(0, 0, width, height);
  }

  ctx.fillStyle = color;
  const centerY = height / 2;
  const maxBarHeight = (height - 4) / 2;
  const step = Math.max(1, Math.floor(peaks.length / width));

  for (let x = 0; x < width; x++) {
    const peakIndex = x * step;
    const value = peaks[peakIndex] ?? 0;
    const barHeight = Math.max(1, value * maxBarHeight);
    ctx.fillRect(x, centerY - barHeight, 1, barHeight * 2);
  }

  return canvas.toDataURL("image/png");
}
