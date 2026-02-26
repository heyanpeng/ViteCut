export type StreamAnalyser = {
  analyser: AnalyserNode;
  context: AudioContext;
  /** 获取当前时域数据（波形） */
  getTimeDomainData: () => Uint8Array;
  /** 销毁资源 */
  destroy: () => void;
};

/**
 * 从 MediaStream 创建 AnalyserNode，用于实时音频波形分析。
 *
 * 适用于任何包含音频轨道的 MediaStream（音频录制、相机+麦克风录制等）。
 *
 * @param stream - 包含音频轨道的 MediaStream
 * @param fftSize - FFT 大小，默认 2048（值越大频率分辨率越高，但计算量更大）
 * @returns StreamAnalyser 对象，包含 analyser、context、getTimeDomainData 方法和 destroy 方法
 *
 * 示例：
 * ```ts
 * const analyser = createStreamAnalyser(stream);
 * const data = analyser.getTimeDomainData();
 * // 使用 data 绘制波形
 * analyser.destroy(); // 使用完毕后销毁
 * ```
 */
export function createStreamAnalyser(
  stream: MediaStream,
  fftSize: number = 2048
): StreamAnalyser {
  const audioTracks = stream.getAudioTracks();
  if (audioTracks.length === 0) {
    throw new Error("MediaStream 不包含音频轨道");
  }

  const context = new AudioContext();
  const source = context.createMediaStreamSource(stream);
  const analyser = context.createAnalyser();
  analyser.fftSize = fftSize;

  source.connect(analyser);

  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);

  return {
    analyser,
    context,
    getTimeDomainData: () => {
      analyser.getByteTimeDomainData(dataArray);
      return dataArray;
    },
    destroy: () => {
      source.disconnect();
      analyser.disconnect();
      if (context.state !== "closed") {
        context.close();
      }
    },
  };
}
