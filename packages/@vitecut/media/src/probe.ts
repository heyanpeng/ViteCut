import type { MediaInfo, MediaSource, MediaTrackAudioInfo, MediaTrackVideoInfo } from './types';
import { createInputFromSource } from './input';

/**
 * 解析媒体的基础信息（时长 / 主视频轨 / 主音频轨参数）。
 *
 * 该方法只做轻量级解析，不返回全部帧数据。
 */
export async function probeMedia(source: MediaSource): Promise<MediaInfo> {
  const input = createInputFromSource(source);

  const duration = await input.computeDuration();

  const [videoTrack, audioTrack] = await Promise.all([
    input.getPrimaryVideoTrack().catch(() => null),
    input.getPrimaryAudioTrack().catch(() => null),
  ]);

  const video: MediaTrackVideoInfo | undefined = videoTrack
    ? {
        displayWidth: videoTrack.displayWidth,
        displayHeight: videoTrack.displayHeight,
        rotation: videoTrack.rotation,
        codec: videoTrack.codec,
      }
    : undefined;

  const audio: MediaTrackAudioInfo | undefined = audioTrack
    ? {
        sampleRate: audioTrack.sampleRate,
        numberOfChannels: audioTrack.numberOfChannels,
        codec: audioTrack.codec,
      }
    : undefined;

  return {
    duration,
    video,
    audio,
  };
}

