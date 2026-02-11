import { useEffect, useMemo, useRef, useState } from "react";
import type { TimelineState } from "@swiftav/timeline";
import { ReactTimeline } from "@swiftav/timeline";
import { PlaybackControls } from "./PlaybackControls";
import { useProjectStore } from "@/stores";
import "./Timeline.css";

export function Timeline() {
  const project = useProjectStore((s) => s.project);
  const setIsPlayingGlobal = useProjectStore((s) => s.setIsPlaying);
  const setCurrentTimeGlobal = useProjectStore((s) => s.setCurrentTime);

  // 将 Project 中的轨道/片段转换为 ReactTimeline 需要的 editorData 结构
  const editorData = useMemo(() => {
    if (!project) {
      return [];
    }

    return project.tracks.map((track) => ({
      id: track.id,
      actions: track.clips.map((clip) => ({
        id: clip.id,
        start: clip.start,
        end: clip.end,
        effectId: clip.assetId,
      })),
    }));
  }, [project]);

  const effects = useMemo(() => {
    if (!project) {
      return {};
    }

    const map: Record<string, { id: string; name: string }> = {};
    for (const asset of project.assets) {
      map[asset.id] = {
        id: asset.id,
        name: asset.name || asset.id,
      };
    }
    return map;
  }, [project]);

  const timelineRef = useRef<TimelineState | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [scaleWidth, setScaleWidth] = useState(160); // 每个主刻度宽度（px）
  const timelineContainerRef = useRef<HTMLDivElement | null>(null);

  const duration = useMemo(() => {
    return editorData.reduce((max, row) => {
      const rowMax = row.actions.reduce(
        (rowEnd: number, action: { end: number }) => Math.max(rowEnd, action.end),
        0,
      );
      return Math.max(max, rowMax);
    }, 0);
  }, [editorData]);

  const handleTogglePlay = () => {
    const api = timelineRef.current;
    if (!api) return;

    if (isPlaying) {
      api.pause();
      setIsPlaying(false);
      setIsPlayingGlobal(false);
    } else {
      // 不调用 api.play()，由 Preview 的 rAF 驱动 currentTime，Timeline 只同步显示
      setIsPlaying(true);
      setIsPlayingGlobal(true);
    }
  };

  const handleStepBackward = () => {
    const api = timelineRef.current;
    if (!api) return;
    api.setTime(0);
    setCurrentTime(0);
    setCurrentTimeGlobal(0);
  };

  const handleStepForward = () => {
    const api = timelineRef.current;
    if (!api) return;
    const end = duration;
    api.setTime(end);
    setCurrentTime(end);
    setCurrentTimeGlobal(end);
  };

  // 播放时从 store 同步 currentTime 到 Timeline 播放头（时间由 Preview 的 rAF 驱动），使用 rAF 提升平滑度
  useEffect(() => {
    if (!isPlaying) return;

    let frameId: number | null = null;

    const loop = () => {
      const t = useProjectStore.getState().currentTime;
      setCurrentTime(t);
      timelineRef.current?.setTime?.(t);

      if (t >= duration && duration > 0) {
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
  }, [isPlaying, duration]);

  // 参考 media-player：拖动时只更新本地时间显示，不写 store，避免 Preview 在拖动过程中连续 seek
  const handleCursorDrag = (time: number) => {
    setCurrentTime(time);
  };

  // 松手时才同步到 store 并更新画面（与 media-player 的 seekToTime 在 pointerup 时调用一致）
  const handleCursorDragEnd = (time: number) => {
    setCurrentTime(time);
    setCurrentTimeGlobal(time);
  };

  const handleZoomOut = () => {
    setScaleWidth((prev) => Math.max(prev / 1.25, 40));
  };

  const handleZoomIn = () => {
    setScaleWidth((prev) => Math.min(prev * 1.25, 400));
  };

  const handleFitToView = () => {
    const container = timelineContainerRef.current;
    if (!container || duration <= 0) return;

    const width = container.clientWidth || window.innerWidth;
    const startLeft = 20;
    const tickCount = Math.max(Math.ceil(duration), 1); // 粗略按 1s 一个刻度
    const target = (width - startLeft) / tickCount;

    setScaleWidth(Math.min(Math.max(target, 40), 400));
    const api = timelineRef.current;
    api?.setScrollLeft(0);
  };

  return (
    <div className="app-editor-layout__timeline">
      <PlaybackControls
        isPlaying={isPlaying}
        currentTime={currentTime}
        duration={duration}
        onTogglePlay={handleTogglePlay}
        onStepBackward={handleStepBackward}
        onStepForward={handleStepForward}
        onZoomOut={handleZoomOut}
        onZoomIn={handleZoomIn}
        onFitToView={handleFitToView}
      />
      <div className="app-editor-layout__timeline-content">
        {editorData.length === 0 ? (
          <div className="timeline-editor timeline-editor--empty" ref={timelineContainerRef}>
            <p className="app-editor-layout__timeline-message">
              将媒体添加到时间轴以开始创建视频
            </p>
          </div>
        ) : (
          <div className="timeline-editor" ref={timelineContainerRef}>
            <ReactTimeline
            ref={timelineRef}
            // 第三方库目前未导出 TS 类型，这里先使用 any 以便后续迭代替换为真实数据结构
            editorData={editorData as any}
            effects={effects as any}
            scale={1}
            scaleWidth={scaleWidth}
            startLeft={20}
            minScaleCount={20}
            maxScaleCount={200}
            onCursorDrag={handleCursorDrag}
            onCursorDragEnd={handleCursorDragEnd}
            onClickTimeArea={(time: number) => {
              const api = timelineRef.current;
              if (api) {
                api.pause();
                api.setTime(time);
              }
              setIsPlaying(false);
              setCurrentTime(time);
              setCurrentTimeGlobal(time);
              setIsPlayingGlobal(false);
              return false;
            }}
          />
          </div>
        )}
      </div>
    </div>
  );
}
