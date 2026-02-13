import { useEffect, useMemo, useRef, useState } from "react";
import type { TimelineState } from "@swiftav/timeline";
import { ReactTimeline } from "@swiftav/timeline";
import type { Clip } from "@swiftav/project";
import { PlaybackControls } from "./playbackControls/PlaybackControls";
import { useProjectStore } from "@/stores";
import { formatTimeLabel } from "@swiftav/utils";
import { playbackClock } from "@/editor/preview/playbackClock";
import {
  useVideoThumbnails,
  getThumbCellsForClip,
} from "./useVideoThumbnails";
import "./Timeline.css";

/**
 * 轨道之间的垂直间距（px）。
 *
 * 说明：
 * - `ReactTimeline` 的 `rowHeight` 只支持“整行高度”，不直接支持 row gap。
 * - 我们的做法是：把 rowHeight 设为「内容高度 + gap」，并在 CSS 中给每行加 padding-bottom，
 *   同时裁切背景/限制 action 高度，让 gap 区域保持空白。
 * - **注意**：这里的数值需要与 `Timeline.css` 里的 `--swiftav-timeline-track-gap` 保持一致。
 */
const TIMELINE_TRACK_GAP_PX = 8;
/**
 * 每条轨道可编辑内容区域的高度（px），不包含 gap。
 * 该值来自第三方时间轴默认行高的视觉基准。
 */
const TIMELINE_TRACK_CONTENT_HEIGHT_PX = 50;
/**
 * 传给第三方时间轴的 rowHeight（px）。
 * rowHeight = 内容高度 + gap
 */
const TIMELINE_ROW_HEIGHT_PX =
  TIMELINE_TRACK_CONTENT_HEIGHT_PX + TIMELINE_TRACK_GAP_PX;

/**
 * Timeline 时间轴主组件
 * 显示项目的多轨时间轴、播放控制、缩放与同步功能
 */
export function Timeline() {
  // ================
  // 全局状态 & actions
  // ================
  const project = useProjectStore((s) => s.project);
  const setIsPlayingGlobal = useProjectStore((s) => s.setIsPlaying);
  const setCurrentTimeGlobal = useProjectStore((s) => s.setCurrentTime);
  const updateClipTiming = useProjectStore((s) => s.updateClipTiming);

  // ================
  // ref & 本地 state
  // ================
  /** timelineRef 用于操作 timeline 实例内部 API */
  const timelineRef = useRef<TimelineState | null>(null);
  /** timeline 外层 dom 容器引用，用于测量宽度 */
  const timelineContainerRef = useRef<HTMLDivElement | null>(null);

  /** 播放状态 */
  const [isPlaying, setIsPlaying] = useState(false);
  /** 当前播放时间（秒） */
  const [currentTime, setCurrentTime] = useState(0);
  /** 每一主刻度的宽度（像素），支持缩放 */
  const [scaleWidth, setScaleWidth] = useState(50);
  /**
   * 为了避免时间轴头部「刻度区域」比可视宽度短而出现右侧留白，
   * 我们根据容器宽度和当前 scaleWidth 动态计算一个最小刻度数，
   * 让刻度始终至少铺满当前视口宽度。
   */
  const [minScaleCountForView, setMinScaleCountForView] = useState(20);

  /** 视频缩略图：按 asset 维度缓存，由 useVideoThumbnails 生成并随 scaleWidth 追加 */
  const videoThumbnails = useVideoThumbnails(project, scaleWidth);

  // ================
  // 衍生数据 useMemo
  // ================
  /**
   * 将 project.tracks/clips 转为 ReactTimeline 所需的数据结构
   * 轨道按 order 降序（order 越大越靠上）
   */
  const editorData = useMemo(() => {
    if (!project) {
      return [];
    }

    // 克隆并排序轨道
    const sortedTracks = [...project.tracks].sort((a, b) => b.order - a.order);
    return sortedTracks.map((track) => ({
      id: track.id,
      actions: track.clips.map((clip) => ({
        id: clip.id,
        start: clip.start,
        end: clip.end,
        effectId: clip.assetId, // 关联素材
      })),
    }));
  }, [project]);

  /**
   * 构建 effect map：将 assetId 映射为 {id, name}
   * 用于 timeline 显示素材关联
   */
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

  /**
   * clipId -> Clip 的快速索引（避免在自定义渲染里反复遍历 tracks）
   */
  const clipById = useMemo(() => {
    if (!project) {
      return {} as Record<string, Clip>;
    }
    const map: Record<string, Clip> = {};
    for (const track of project.tracks) {
      for (const clip of track.clips) {
        map[clip.id] = clip;
      }
    }
    return map;
  }, [project]);

  /**
   * 计算当前时间轴的最大时长
   * 取所有轨道所有片段的 end 最大值
   */
  const duration = useMemo(() => {
    return editorData.reduce((max, row) => {
      const rowMax = row.actions.reduce(
        (rowEnd: number, action: { end: number }) =>
          Math.max(rowEnd, action.end),
        0,
      );
      return Math.max(max, rowMax);
    }, 0);
  }, [editorData]);

  /**
   * 自定义 action 渲染：为视频 clip 显示缩略图网格，依赖 useVideoThumbnails 与 getThumbCellsForClip。
   */
  const getActionRender = (action: any) => {
    if (!project) {
      return undefined;
    }
    const clip: Clip | undefined = clipById[action.id];
    if (!clip || clip.kind !== "video") {
      return undefined;
    }
    const assetThumb = videoThumbnails[clip.assetId];
    const result = getThumbCellsForClip(
      assetThumb,
      clip,
      action,
      scaleWidth,
      TIMELINE_TRACK_CONTENT_HEIGHT_PX,
    );
    if (!result) {
      return undefined;
    }
    const { cells, aspectRatio } = result;
    return (
      <div className="swiftav-timeline-video-clip">
        <div
          className="swiftav-timeline-video-clip__thumbs"
          style={
            {
              "--thumb-aspect-ratio": aspectRatio,
            } as React.CSSProperties
          }
        >
          {cells.map((src, index) => (
            <div
              key={index}
              className="swiftav-timeline-video-clip__thumb-cell"
            >
              {src ? (
                <img src={src} alt="" />
              ) : (
                <div className="swiftav-timeline-video-clip__thumb-placeholder" />
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  /**
   * 时间轴空白区域点击：跳到指定时间并暂停播放，同时同步本地与全局播放状态。
   */
  const handleClickTimeArea = (time: number) => {
    const timelineState = timelineRef.current;
    // 暂停播放并跳转到点击时间点
    if (timelineState) {
      timelineState.pause();
      timelineState.setTime(time);
    }
    // 更新本地播放状态和当前时间
    setIsPlaying(false);
    setCurrentTime(time);
    // 同步全局状态
    setCurrentTimeGlobal(time);
    setIsPlayingGlobal(false);
    // 返回 false 禁止事件冒泡
    return false;
  };

  /**
   * 播放/暂停切换逻辑
   * 这里只切 UI 状态及全局 store，不实际操作媒体播放
   */
  const handleTogglePlay = () => {
    const timelineState = timelineRef.current;
    if (!timelineState) {
      return;
    }

    if (isPlaying) {
      // 暂停：用播放时钟的当前值同步一次全局 currentTime
      const t = playbackClock.currentTime;
      setCurrentTime(t);
      setCurrentTimeGlobal(t);
      timelineState.pause();
      setIsPlaying(false);
      setIsPlayingGlobal(false);
    } else {
      // 若已播到末尾，再次点击播放时从头开始
      const end = duration;
      const t = useProjectStore.getState().currentTime;
      if (end > 0 && t >= end) {
        timelineState.setTime(0);
        setCurrentTime(0);
        setCurrentTimeGlobal(0);
      }

      // 播放（由 Preview rAF 驱动 currentTime，这里只设状态即可）
      setIsPlaying(true);
      setIsPlayingGlobal(true);
    }
  };

  /**
   * 一键回到时间轴开头，并暂停播放
   */
  const handleStepBackward = () => {
    const timelineState = timelineRef.current;
    if (!timelineState) return;
    timelineState.pause();
    setIsPlaying(false);
    setIsPlayingGlobal(false);
    timelineState.setTime(0);
    setCurrentTime(0);
    setCurrentTimeGlobal(0);
  };

  /**
   * 一键跳转到时间轴末尾，并暂停播放
   */
  const handleStepForward = () => {
    const timelineState = timelineRef.current;
    if (!timelineState) return;
    timelineState.pause();
    setIsPlaying(false);
    setIsPlayingGlobal(false);
    const end = duration;
    timelineState.setTime(end);
    setCurrentTime(end);
    setCurrentTimeGlobal(end);
  };

  /**
   * 拖动播放头时，只实时刷新本地 currentTime 不写全局 store
   * - 提升拖动体验，防止 Preview 因 seek 频繁过多
   */
  const handleCursorDrag = (time: number) => {
    setCurrentTime(time);
  };

  /**
   * 拖动播放头松手时（pointerup），同步到全局 store
   * - 保持 UI 一致，并触发实际画面跳转
   */
  const handleCursorDragEnd = (time: number) => {
    setCurrentTime(time);
    setCurrentTimeGlobal(time);
  };

  /**
   * 时间轴缩小（scaleWidth 变小，刻度间距缩短）
   * 取最小 40px/格
   */
  const handleZoomOut = () => {
    setScaleWidth((prev) => Math.max(prev / 1.25, 40));
  };

  /**
   * 时间轴放大（scaleWidth 变大，刻度间距变宽）
   * 最大 400px/格
   */
  const handleZoomIn = () => {
    setScaleWidth((prev) => Math.min(prev * 1.25, 400));
  };

  /**
   * 适应视图区宽度自动缩放
   * 算法：以当前可见区刚好容纳全部时长为目标
   * 刻度间距限制 40-400px
   */
  const handleFitToView = () => {
    const container = timelineContainerRef.current;
    if (!container || duration <= 0) {
      return;
    }

    const width = container.clientWidth || window.innerWidth;
    const startLeft = 20;
    const tickCount = Math.max(Math.ceil(duration), 1); // 每秒一个刻度
    const target = (width - startLeft) / tickCount;

    setScaleWidth(Math.min(Math.max(target, 40), 400));

    const timelineState = timelineRef.current;
    timelineState?.setScrollLeft(0); // 滚动回到起点
  };

  /**
   * 根据容器宽度和当前 scaleWidth 计算「视口下需要的最少刻度数」，
   * 确保刻度网格可以铺满整条时间轴的可视区域，而不是只画到时长末尾后右侧一大片空白。
   */
  useEffect(() => {
    const container = timelineContainerRef.current;
    if (!container) {
      return;
    }

    const width = container.clientWidth || window.innerWidth;
    const startLeft = 20;
    const availableWidth = Math.max(0, width - startLeft);
    const effectiveScaleWidth = Math.max(1, scaleWidth);
    const ticksForView = Math.ceil(availableWidth / effectiveScaleWidth);

    setMinScaleCountForView((prev) =>
      // 避免因为浮动抖动频繁 setState，取当前值与新值的较大者
      Math.max(prev, Math.max(1, ticksForView)),
    );
  }, [scaleWidth]);

  /**
   * 播放同步逻辑
   * - 由全局播放时钟（playbackClock）驱动 timeline 播放头位置
   * - 用 requestAnimationFrame 循环，保持播放期间的平滑性
   * - 达到时长末尾时自动停止
   */
  useEffect(() => {
    if (!isPlaying) {
      return;
    }

    let frameId: number | null = null;

    const loop = () => {
      const t = playbackClock.currentTime;
      setCurrentTime(t);
      timelineRef.current?.setTime?.(t);

      const dur = duration;
      if (t >= dur && dur > 0) {
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

  return (
    <div className="app-editor-layout__timeline">
      {/* 播放控制区 */}
      <PlaybackControls
        isPlaying={isPlaying}
        currentTime={currentTime}
        duration={duration}
        disabled={!project}
        onTogglePlay={handleTogglePlay}
        onStepBackward={handleStepBackward}
        onStepForward={handleStepForward}
        onZoomOut={handleZoomOut}
        onZoomIn={handleZoomIn}
        onFitToView={handleFitToView}
      />
      <div className="app-editor-layout__timeline-content">
        {editorData.length === 0 ? (
          // 如果当前没内容，提示添加媒体
          <div
            className="timeline-editor timeline-editor--empty"
            ref={timelineContainerRef}
          >
            <p className="app-editor-layout__timeline-message">
              将媒体添加到时间轴以开始创建视频
            </p>
          </div>
        ) : (
          // 主时间轴区域
          <div className="timeline-editor" ref={timelineContainerRef}>
            <ReactTimeline
              ref={timelineRef}
              // @ts-ignore: 第三方库未导出 TS 类型。后续有风险请逐步替换。
              editorData={editorData as any}
              // 轨道关联资源字典，key为素材assetId，value为{id, name}
              effects={effects as any}
              // 轨道行高（包含轨道之间的 gap）
              rowHeight={TIMELINE_ROW_HEIGHT_PX}
              // 主刻度（每段的 "时间长度"，单位：秒），此处为1表示每格1秒
              scale={1}
              // 每主刻度的细分数，将1秒细分为10份用于显示子网格线
              scaleSplitCount={10}
              // 每一主刻度（1秒）横向显示宽度（像素），由 state 维护支持缩放
              scaleWidth={scaleWidth}
              // 时间轴内容距离左侧起始空白距离（像素）
              startLeft={20}
              // 最小主刻度数：既要覆盖当前时长，也要至少铺满当前视口宽度，避免刻度区域右侧留白
              minScaleCount={Math.max(
                1,
                Math.ceil(duration),
                minScaleCountForView,
              )}
              // 最大主刻度数：与最小值保持一致，这里不再额外预留超长空白区域
              maxScaleCount={Math.max(
                1,
                Math.ceil(duration),
                minScaleCountForView,
              )}
              // 自定义 action 渲染：为视频 clip 显示缩略图
              // @ts-ignore: 第三方类型未暴露 getActionRender，运行时支持该属性
              getActionRender={getActionRender}
              // 拖拽移动 clip 结束后：将新 start/end 写回 project（否则预览/导出仍用旧时间）
              onActionMoveEnd={({ action, row, start, end }) => {
                updateClipTiming(action.id, start, end, row.id);
              }}
              // 改变 clip 长度结束后：同样写回 start/end（例如裁剪时长）
              onActionResizeEnd={({ action, row, start, end }) => {
                updateClipTiming(action.id, start, end, row.id);
              }}
              // 刻度标签自定义渲染函数，这里显示为“分:秒”格式
              getScaleRender={(scale) => <>{formatTimeLabel(scale)}</>}
              // 拖动光标事件，处理当前时间更新
              onCursorDrag={handleCursorDrag}
              // 光标拖动结束事件（常用于同步全局状态）
              onCursorDragEnd={handleCursorDragEnd}
              // 区域点击回调，跳到指定时间并暂停播放，需多处更新本地及全局播放状态
              onClickTimeArea={handleClickTimeArea}
            />
          </div>
        )}
      </div>
    </div>
  );
}
