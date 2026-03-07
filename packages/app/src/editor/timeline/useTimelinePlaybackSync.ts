import { useEffect } from "react";
import type { TimelineState } from "@vitecut/timeline";
import { playbackClock } from "@/editor/preview/playbackClock";

/** 播放期间 UI 时间同步间隔（秒）（如控制栏的 currentTime 低频同步） */
const PLAYING_UI_TIME_SYNC_INTERVAL_S = 1 / 20;

/** useTimelinePlaybackSync 接收的参数类型定义 */
type TimelinePlaybackSyncParams = {
  isPlaying: boolean;
  duration: number;
  currentTime: number;
  timelineRef: { current: TimelineState | null };
  setCurrentTime: (time: number) => void;
  setIsPlaying: (playing: boolean) => void;
  setIsPlayingGlobal: (playing: boolean) => void;
  /** 每帧回调（与播放渲染帧同步） */
  onFrameTime?: (time: number) => void;
};

/**
 * 时间轴播放同步：
 * - 播放期使用命令式 setTime 每帧驱动播放头；
 * - currentTime 仅低频同步给控制栏文案，避免多轨场景高频重渲染；
 * - 播放期不透传 currentTime prop，避免与命令式更新互相覆盖。
 */
export function useTimelinePlaybackSync({
  isPlaying,
  duration,
  currentTime,
  timelineRef,
  setCurrentTime,
  setIsPlaying,
  setIsPlayingGlobal,
  onFrameTime,
}: TimelinePlaybackSyncParams): number | undefined {
  useEffect(() => {
    if (!isPlaying) {
      return;
    }
    if (duration <= 0) {
      setIsPlaying(false);
      setIsPlayingGlobal(false);
      return;
    }

    let frameId: number | null = null;
    let lastRenderedTime = -Infinity;
    let lastUiSyncedTime = -Infinity;
    const endTime = Math.max(0, duration);

    const loop = () => {
      const t = Math.max(lastRenderedTime, playbackClock.currentTime);
      const clampedTime = Math.min(t, endTime);
      lastRenderedTime = clampedTime;
      timelineRef.current?.setTime?.(clampedTime);
      onFrameTime?.(clampedTime);

      if (clampedTime - lastUiSyncedTime >= PLAYING_UI_TIME_SYNC_INTERVAL_S) {
        setCurrentTime(clampedTime);
        lastUiSyncedTime = clampedTime;
      }

      if (clampedTime >= endTime) {
        setCurrentTime(endTime);
        setIsPlaying(false);
        setIsPlayingGlobal(false);
        return;
      }

      frameId = requestAnimationFrame(loop);
    };

    frameId = requestAnimationFrame(loop);

    return () => {
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
      }
    };
  }, [
    duration,
    isPlaying,
    setCurrentTime,
    setIsPlaying,
    setIsPlayingGlobal,
    timelineRef,
    onFrameTime,
  ]);

  return isPlaying ? undefined : currentTime;
}
