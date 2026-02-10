import { useEffect, useMemo, useRef, useState } from "react";
import type { TimelineState } from "@swiftav/timeline";
import { ReactTimeline } from "@swiftav/timeline";
import { PlaybackControls } from "./PlaybackControls";
import "./Timeline.css";

export function Timeline() {
  const editorData = useMemo(
    () => [
      {
        id: "0",
        actions: [
          {
            id: "action00",
            start: 0,
            end: 2,
            effectId: "effect0",
          },
        ],
      },
      {
        id: "1",
        actions: [
          {
            id: "action10",
            start: 1.5,
            end: 5,
            effectId: "effect1",
          },
        ],
      },
    ],
    [],
  );

  const effects = useMemo(
    () => ({
      effect0: {
        id: "effect0",
        name: "效果 0",
      },
      effect1: {
        id: "effect1",
        name: "效果 1",
      },
    }),
    [],
  );

  const timelineRef = useRef<TimelineState | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [scaleWidth, setScaleWidth] = useState(160); // 每个主刻度宽度（px）
  const timelineContainerRef = useRef<HTMLDivElement | null>(null);

  const duration = useMemo(() => {
    return editorData.reduce((max, row) => {
      const rowMax = row.actions.reduce(
        (rowEnd, action) => Math.max(rowEnd, action.end),
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
    } else {
      api.play({ autoEnd: true });
      setIsPlaying(true);
    }
  };

  const handleStepBackward = () => {
    const api = timelineRef.current;
    if (!api) return;
    api.setTime(0);
    setCurrentTime(0);
  };

  const handleStepForward = () => {
    const api = timelineRef.current;
    if (!api) return;
    const end = duration;
    api.setTime(end);
    setCurrentTime(end);
  };

  // 播放时定期从 TimelineState 读取时间，用较低频率刷新数字，避免卡顿
  useEffect(() => {
    if (!isPlaying) return;
    const timer = window.setInterval(() => {
      const t = timelineRef.current?.getTime?.() ?? 0;
      setCurrentTime(t);
      // 播放结束后自动恢复为“可播放”状态
      if (t >= duration) {
        setIsPlaying(false);
      }
    }, 100); // 10fps 足够平滑

    return () => window.clearInterval(timer);
  }, [isPlaying, duration]);

  // 使用库提供的事件更新当前时间，避免每帧强制刷新导致卡顿
  const handleCursorTimeChange = (time: number) => {
    setCurrentTime(time);
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
            onCursorDrag={handleCursorTimeChange}
            onCursorDragEnd={handleCursorTimeChange}
            onClickTimeArea={(time: number) => {
              const api = timelineRef.current;
              if (api) {
                api.pause();
                api.setTime(time);
              }
              setIsPlaying(false);
              handleCursorTimeChange(time);
              // 我们已经手动设置了时间，这里返回 false 阻止默认行为
              return false;
            }}
          />
        </div>
      </div>
    </div>
  );
}
