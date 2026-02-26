import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TimelineState } from "@vitecut/timeline";
import { ReactTimeline } from "@vitecut/timeline";
import type { Clip } from "@vitecut/project";
import { Button } from "@radix-ui/themes";
import { Volume2, VolumeX } from "lucide-react";
import { PlaybackControls } from "./playbackControls/PlaybackControls";
import { useProjectStore } from "@/stores";
import { formatTimeLabel } from "@vitecut/utils";
import { useTimelineHotkeys } from "@vitecut/hotkeys";
import { playbackClock } from "@/editor/preview/playbackClock";
import { useVideoThumbnails, getThumbCellsForClip } from "./useVideoThumbnails";
import { useAudioWaveform, getWaveformDataUrl } from "./useAudioWaveform";
import "./Timeline.css";

/** 轨道前置列宽度（音量按钮列），与 @vitecut/timeline 的 rowPrefixWidth 一致 */
const TIMELINE_ROW_PREFIX_WIDTH_PX = 48;

/**
 * 轨道之间的垂直间距（px）。
 *
 * 说明：
 * - `ReactTimeline` 的 `rowHeight` 只支持“整行高度”，不直接支持 row gap。
 * - 我们的做法是：把 rowHeight 设为「内容高度 + gap」，并在 CSS 中给每行加 padding-bottom，
 *   同时裁切背景/限制 action 高度，让 gap 区域保持空白。
 * - **注意**：这里的数值需要与 `Timeline.css` 里的 `--vitecut-timeline-track-gap` 保持一致。
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
  const duration = useProjectStore((s) => s.duration);
  const setIsPlayingGlobal = useProjectStore((s) => s.setIsPlaying);
  const setCurrentTimeGlobal = useProjectStore((s) => s.setCurrentTime);
  const updateClipTiming = useProjectStore((s) => s.updateClipTiming);
  const reorderTracks = useProjectStore((s) => s.reorderTracks);
  const toggleTrackMuted = useProjectStore((s) => s.toggleTrackMuted);
  const duplicateClip = useProjectStore((s) => s.duplicateClip);
  const cutClip = useProjectStore((s) => s.cutClip);
  const deleteClip = useProjectStore((s) => s.deleteClip);
  const trimClipLeft = useProjectStore((s) => s.trimClipLeft);
  const trimClipRight = useProjectStore((s) => s.trimClipRight);
  const undo = useProjectStore((s) => s.undo);
  const redo = useProjectStore((s) => s.redo);
  const historyPast = useProjectStore((s) => s.historyPast);
  const historyFuture = useProjectStore((s) => s.historyFuture);
  const selectedClipId = useProjectStore((s) => s.selectedClipId);
  const setSelectedClipId = useProjectStore((s) => s.setSelectedClipId);

  // ================
  // ref & 本地 state
  // ================
  /** timelineRef 用于操作 timeline 实例内部 API */
  const timelineRef = useRef<TimelineState | null>(null);
  /** timeline 外层 dom 容器引用，用于测量宽度 */
  const timelineContainerRef = useRef<HTMLDivElement | null>(null);
  /** 时间轴横向滚动位置，用于「任意空白处点击」时根据 clientX 换算时间 */
  const timelineScrollLeftRef = useRef(0);
  /** 标记下一次背景点击是否需要抑制（用于拖拽 clip 结束后的误触） */
  const suppressNextTimeJumpRef = useRef(false);

  /** 播放状态 */
  const [isPlaying, setIsPlaying] = useState(false);
  /** 当前播放时间（秒） */
  const [currentTime, setCurrentTime] = useState(0);
  /** 每秒对应的像素宽度，支持缩放 */
  const [pxPerSecond, setPxPerSecond] = useState(50);

  const SCALE_STEPS = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600];
  const MIN_TICK_WIDTH_PX = 60;
  const { scale, scaleWidth } = useMemo(() => {
    for (const step of SCALE_STEPS) {
      const w = pxPerSecond * step;
      if (w >= MIN_TICK_WIDTH_PX) {
        return { scale: step, scaleWidth: w };
      }
    }
    const last = SCALE_STEPS[SCALE_STEPS.length - 1];
    return { scale: last, scaleWidth: pxPerSecond * last };
  }, [pxPerSecond]);

  const scaleSplitCount = scale >= 60 ? 6 : scale >= 10 ? 5 : 10;

  /**
   * 为了避免时间轴头部「刻度区域」比可视宽度短而出现右侧留白，
   * 我们根据容器宽度和当前 scaleWidth 动态计算一个最小刻度数，
   * 让刻度始终至少铺满当前视口宽度。
   */
  const [minScaleCountForView, setMinScaleCountForView] = useState(20);

  /** 视频缩略图：按 asset 维度缓存，由 useVideoThumbnails 生成并随 scaleWidth 追加 */
  const videoThumbnails = useVideoThumbnails(project, pxPerSecond);
  /** 音频波形：按 asset 维度缓存，由 useAudioWaveform 解码并缓存峰值 */
  const { entries: audioWaveforms, renderCache: waveformRenderCache } =
    useAudioWaveform(project);

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
      actions: track.clips.map((clip) => {
        const base = {
          id: clip.id,
          start: clip.start,
          end: clip.end,
          effectId: clip.assetId, // 关联素材
          selected: selectedClipId === clip.id, // 库会根据 selected 在 action 根节点加 class，用于选中高亮
        };
        return base;
      }),
    }));
  }, [project, selectedClipId]);

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

  /** 最近一次复制的 clip id，用于粘贴快捷键 */
  const [copiedClipId, setCopiedClipId] = useState<string | null>(null);

  /**
   * 每条轨道左侧音量按钮：静音时 cyan soft，未静音时 gray ghost，点击切换 muted
   */
  const renderRowPrefix = useCallback(
    (row: { id: string }) => {
      const track = project?.tracks.find((t) => t.id === row.id);
      const hasAudioContent = track?.clips.some(
        (c) => c.kind === "video" || c.kind === "audio"
      );
      if (!hasAudioContent) {
        return (
          <div
            className="timeline-track-volume-cell"
            style={{ height: TIMELINE_TRACK_CONTENT_HEIGHT_PX }}
          />
        );
      }
      const muted = track?.muted ?? false;
      return (
        <div
          className="timeline-track-volume-cell"
          style={{ height: TIMELINE_TRACK_CONTENT_HEIGHT_PX }}
        >
          <Button
            color={muted ? "cyan" : "gray"}
            variant={muted ? "soft" : "ghost"}
            size="1"
            className="timeline-track-volume-btn"
            aria-label={muted ? "取消静音" : "静音"}
            onClick={(e) => {
              e.stopPropagation();
              toggleTrackMuted(row.id);
            }}
          >
            {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </Button>
        </div>
      );
    },
    [project, toggleTrackMuted]
  );

  /**
   * 自定义 action 渲染：视频 clip 显示缩略图网格；文本 clip 显示文本内容（靠左）。
   */
  const getActionRender = (action: any) => {
    if (!project) {
      return undefined;
    }
    const clip: Clip | undefined = clipById[action.id];
    if (!clip) {
      return undefined;
    }
    const asset = project.assets.find((a) => a.id === clip.assetId);
    if (asset?.loading) {
      const rawName = asset.name ?? "媒体";
      const name = rawName.replace(/\.[^.]+$/, "") || rawName;
      return (
        <div className="vitecut-timeline-loading-clip" data-vitecut-clip>
          <span className="vitecut-timeline-loading-clip__spinner" />
          <span className="vitecut-timeline-loading-clip__label">{name}</span>
        </div>
      );
    }
    if (clip.kind === "text") {
      const asset = project.assets.find((a) => a.id === clip.assetId);
      const params = (clip.params ?? {}) as { text?: string };
      const text = params.text ?? asset?.textMeta?.initialText ?? "标题文字";
      return (
        <div className="vitecut-timeline-text-clip" data-vitecut-clip>
          <span className="vitecut-timeline-text-clip__label">{text}</span>
        </div>
      );
    }
    if (clip.kind === "image") {
      const asset = project.assets.find((a) => a.id === clip.assetId);
      const source = asset?.source;
      if (!source) {
        return undefined;
      }
      // 根据 clip 在时间轴上的像素宽度和图片宽高比，计算需要重复多少张图片填满
      const imgMeta = asset.imageMeta;
      const aspectRatio =
        imgMeta && imgMeta.height > 0 ? imgMeta.width / imgMeta.height : 1;
      const cellWidthPx = TIMELINE_TRACK_CONTENT_HEIGHT_PX * aspectRatio;
      const clipWidthPx = (action.end - action.start) * pxPerSecond;
      const cellCount = Math.max(1, Math.ceil(clipWidthPx / cellWidthPx));
      return (
        <div
          className="vitecut-timeline-image-clip"
          data-vitecut-clip
          style={
            {
              "--img-aspect-ratio": aspectRatio,
            } as React.CSSProperties
          }
        >
          {Array.from({ length: cellCount }, (_, i) => (
            <div key={i} className="vitecut-timeline-image-clip__cell">
              <img src={source} alt="" draggable={false} />
            </div>
          ))}
        </div>
      );
    }
    if (clip.kind === "audio") {
      const asset = project.assets.find((a) => a.id === clip.assetId);
      const rawName = asset?.name ?? "音频";
      const name = rawName.replace(/\.[^.]+$/, "") || rawName;
      const waveformEntry = audioWaveforms[clip.assetId];
      const clipWidthPx = (action.end - action.start) * pxPerSecond;
      const waveformUrl = getWaveformDataUrl(
        waveformEntry,
        clip.assetId,
        clipWidthPx,
        waveformRenderCache
      );
      return (
        <div
          className={`vitecut-timeline-audio-clip${waveformUrl ? " vitecut-timeline-audio-clip--has-waveform" : ""}`}
          data-vitecut-clip
        >
          {waveformUrl ? (
            <>
              <img
                className="vitecut-timeline-audio-clip__waveform"
                src={waveformUrl}
                alt=""
                draggable={false}
              />
              <span className="vitecut-timeline-audio-clip__label">{name}</span>
            </>
          ) : (
            <>
              <div className="vitecut-timeline-audio-clip__icon">
                <Volume2 size={14} />
              </div>
              <span className="vitecut-timeline-audio-clip__label">{name}</span>
            </>
          )}
        </div>
      );
    }
    if (clip.kind !== "video") {
      return undefined;
    }
    const assetThumb = videoThumbnails[clip.assetId];

    // 视频 clip 预览图生成中时，展示 loading 占位状态
    if (assetThumb?.status === "loading") {
      const rawName = asset?.name ?? "视频";
      const name = rawName.replace(/\.[^.]+$/, "") || rawName;
      return (
        <div className="vitecut-timeline-loading-clip" data-vitecut-clip>
          <span className="vitecut-timeline-loading-clip__spinner" />
          <span className="vitecut-timeline-loading-clip__label">
            正在生成预览图 · {name}
          </span>
        </div>
      );
    }

    const result = getThumbCellsForClip(
      assetThumb,
      clip,
      action,
      pxPerSecond,
      TIMELINE_TRACK_CONTENT_HEIGHT_PX
    );
    if (!result) {
      return undefined;
    }
    const { cells, aspectRatio } = result;
    return (
      <div
        className="vitecut-timeline-video-clip__thumbs"
        data-vitecut-clip
        style={
          {
            "--thumb-aspect-ratio": aspectRatio,
          } as React.CSSProperties
        }
      >
        {cells.map((src, index) => (
          <div key={index} className="vitecut-timeline-video-clip__thumb-cell">
            {src ? (
              <img src={src} alt="" />
            ) : (
              <div className="vitecut-timeline-video-clip__thumb-placeholder" />
            )}
          </div>
        ))}
      </div>
    );
  };

  /**
   * 时间轴空白区域点击：跳到指定时间并暂停播放，同时同步本地与全局播放状态，并取消 clip 选中态（与画布空白点击行为一致）。
   * 时间限制在 [0, duration]，从 store 读取 duration 避免闭包陈旧（clip 拖拽后立即点击时 duration 可能尚未随 re-render 更新）
   */
  const handleClickTimeArea = (time: number) => {
    if (suppressNextTimeJumpRef.current) {
      suppressNextTimeJumpRef.current = false;
      return false;
    }
    const currentDuration = useProjectStore.getState().duration;
    const clampedTime = Math.max(0, Math.min(time, currentDuration));
    const timelineState = timelineRef.current;
    if (timelineState) {
      timelineState.pause();
      timelineState.setTime(clampedTime);
    }
    setIsPlaying(false);
    setCurrentTime(clampedTime);
    setCurrentTimeGlobal(clampedTime);
    setIsPlayingGlobal(false);
    setSelectedClipId(null);
    return false;
  };

  /**
   * 点击轨道行空白处：与点击刻度区一致，跳到该位置时间并暂停播放。
   * 三方库 onClickRow 在点击行（含 clip）时都会触发，需排除点击在 clip 上的情况，否则会误跳转。
   */
  const handleClickRow = (
    e: React.MouseEvent<HTMLElement, MouseEvent>,
    param: { row: unknown; time: number }
  ) => {
    if (suppressNextTimeJumpRef.current) {
      suppressNextTimeJumpRef.current = false;
      return;
    }
    const target = e.target as HTMLElement;
    if (
      target.closest?.("[data-vitecut-clip]") ||
      target.closest?.(".timeline-editor-action") ||
      target.closest?.("[class*='timeline-editor-action']")
    ) {
      return;
    }
    handleClickTimeArea(param.time);
  };

  /** 时间轴内容区横向滚动时同步 scrollLeft，供「任意空白处点击」换算时间用 */
  const handleTimelineScroll = useCallback((params: { scrollLeft: number }) => {
    timelineScrollLeftRef.current = params.scrollLeft;
  }, []);

  /**
   * 点击时间轴容器空白处（刻度区、轨道空白、轨道间隙等）：根据 clientX 换算时间并跳转。
   * 点击轨道上的 clip 时不跳转时间（仅由 onClickActionOnly 处理选中态）。
   */
  const handleTimelineContainerClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (suppressNextTimeJumpRef.current) {
        suppressNextTimeJumpRef.current = false;
        return;
      }
      const target = e.target as HTMLElement;
      if (
        target.closest?.("[data-vitecut-clip]") ||
        target.closest?.(".timeline-editor-action") ||
        target.closest?.("[class*='timeline-editor-action']")
      ) {
        return;
      }
      const container = timelineContainerRef.current;
      if (!container || editorData.length === 0) {
        return;
      }
      const rect = container.getBoundingClientRect();
      const startLeft = 20;
      const contentLeft = rect.left + TIMELINE_ROW_PREFIX_WIDTH_PX;
      if (e.clientX < contentLeft) {
        return;
      }
      const scrollLeft = timelineScrollLeftRef.current;
      const pixelFromStart = e.clientX - contentLeft + scrollLeft - startLeft;
      const time = pixelFromStart / pxPerSecond;
      handleClickTimeArea(time);
    },
    [editorData.length, pxPerSecond]
  );

  /** 仅点击 clip（不包含拖拽）：选中该 clip；再次点击同一 clip 保持选中；取消选中需点击非 clip 区域 */
  const handleClickActionOnly = (
    _e: React.MouseEvent,
    { action }: { action: { id: string } }
  ) => {
    requestAnimationFrame(() => {
      setSelectedClipId(action.id);
    });
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
    setPxPerSecond((prev) => Math.max(prev / 1.25, 1));
  };

  /**
   * 时间轴放大（scaleWidth 变大，刻度间距变宽）
   * 最大 400px/格
   */
  const handleZoomIn = () => {
    setPxPerSecond((prev) => Math.min(prev * 1.25, 500));
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

    setPxPerSecond(Math.min(Math.max(target, 1), 500));

    const timelineState = timelineRef.current;
    timelineState?.setScrollLeft(0); // 滚动回到起点
  };

  const handleTrimClipLeft = () => {
    if (!selectedClipId) return;
    const clip = clipById[selectedClipId];
    if (!clip) return;
    if (currentTime <= clip.start || currentTime >= clip.end) return;
    trimClipLeft(selectedClipId);
  };

  const handleTrimClipRight = () => {
    if (!selectedClipId) return;
    const clip = clipById[selectedClipId];
    if (!clip) return;
    if (currentTime <= clip.start || currentTime >= clip.end) return;
    trimClipRight(selectedClipId);
  };

  const handleCutSelectedClip = () => {
    if (!selectedClipId) return;
    const clip = clipById[selectedClipId];
    if (!clip) return;
    if (currentTime <= clip.start || currentTime >= clip.end) return;
    cutClip(selectedClipId);
  };

  const handleCopySelectedClip = () => {
    if (!selectedClipId) return;
    duplicateClip(selectedClipId);
  };

  const handleDeleteSelectedClip = () => {
    if (!selectedClipId) return;
    deleteClip(selectedClipId);
    setSelectedClipId(null);
  };

  const selectedClip =
    selectedClipId != null ? clipById[selectedClipId] : undefined;

  const canOperateOnSelectedClip = () => {
    if (!selectedClip) return false;
    return currentTime > selectedClip.start && currentTime < selectedClip.end;
  };

  // 全局快捷键：复制 / 粘贴 / 删除 / 撤销 / 重做 / 缩放
  // 仅在存在可执行操作时启用快捷键（有工程可播放/切断，或可撤销/重做，或存在选中/已复制 clip）
  // 缩放快捷键始终启用，不受此限制
  const hotkeysEnabled =
    !!project ||
    historyPast.length > 0 ||
    historyFuture.length > 0 ||
    !!selectedClipId ||
    !!copiedClipId;

  useTimelineHotkeys({
    enabled: hotkeysEnabled,
    onTogglePlay: handleTogglePlay,
    onCopyClip: () => {
      if (!selectedClipId) return;
      setCopiedClipId(selectedClipId);
    },
    onPasteClip: () => {
      const sourceId = copiedClipId ?? selectedClipId;
      if (!sourceId) return;
      duplicateClip(sourceId);
    },
    onCutClip: () => {
      if (!selectedClipId) return;
      const clip = clipById[selectedClipId];
      if (!clip) return;
      if (currentTime <= clip.start || currentTime >= clip.end) return;
      cutClip(selectedClipId);
    },
    onDeleteClip: () => {
      if (!selectedClipId) return;
      deleteClip(selectedClipId);
      setSelectedClipId(null);
    },
    onUndo: () => undo(),
    onRedo: () => redo(),
    onZoomIn: handleZoomIn,
    onZoomOut: handleZoomOut,
    onZoomFit: handleFitToView,
  });

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
      Math.max(prev, Math.max(1, ticksForView))
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
  }, [isPlaying, duration, setIsPlayingGlobal]);

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
        onTrimClipLeft={
          selectedClipId && canOperateOnSelectedClip()
            ? handleTrimClipLeft
            : undefined
        }
        onTrimClipRight={
          selectedClipId && canOperateOnSelectedClip()
            ? handleTrimClipRight
            : undefined
        }
        onCutClip={
          selectedClipId && canOperateOnSelectedClip()
            ? handleCutSelectedClip
            : undefined
        }
        onCopyClip={selectedClipId ? handleCopySelectedClip : undefined}
        onDeleteClip={selectedClipId ? handleDeleteSelectedClip : undefined}
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
          // 主时间轴区域（任意空白处点击都会根据 clientX 跳转时间）
          <div
            className="timeline-editor"
            ref={timelineContainerRef}
            onClick={handleTimelineContainerClick}
            role="presentation"
          >
            <ReactTimeline
              ref={timelineRef}
              // @ts-ignore: 第三方库未导出 TS 类型。后续有风险请逐步替换。
              editorData={editorData as any}
              // 轨道关联资源字典，key为素材assetId，value为{id, name}
              effects={effects as any}
              style={{ width: "100%", height: "100%" }}
              // 轨道行高（包含轨道之间的 gap）
              rowHeight={TIMELINE_ROW_HEIGHT_PX}
              rowPrefixTopOffset={42}
              rowPrefixWidth={TIMELINE_ROW_PREFIX_WIDTH_PX}
              scale={scale}
              scaleSplitCount={scaleSplitCount}
              // 每一主刻度（1秒）横向显示宽度（像素），由 state 维护支持缩放
              scaleWidth={scaleWidth}
              // 时间轴内容距离左侧起始空白距离（像素）
              startLeft={20}
              // 最小主刻度数：既要覆盖当前时长，也要至少铺满当前视口宽度，避免刻度区域右侧留白
              minScaleCount={Math.max(
                1,
                Math.ceil(duration / scale),
                minScaleCountForView
              )}
              // 最大主刻度数：Infinity 让库根据 editorData 自由扩展，避免 clip 右移后时间轴无法滚动到新范围
              maxScaleCount={Infinity}
              renderRowPrefix={renderRowPrefix}
              // 自定义 action 渲染：为视频 clip 显示缩略图
              // @ts-ignore: 第三方类型未暴露 getActionRender，运行时支持该属性
              getActionRender={getActionRender}
              // 拖拽移动 clip 结束后：将新 start/end 写回 project（否则预览/导出仍用旧时间）
              onActionMoveEnd={({ action, row, start, end }) => {
                updateClipTiming(action.id, start, end, row.id);
                setSelectedClipId(action.id);
                // 标记：下一次背景点击可能是拖拽结束触发的“误点”，需要抑制一次时间跳转
                suppressNextTimeJumpRef.current = true;
                window.setTimeout(() => {
                  suppressNextTimeJumpRef.current = false;
                }, 200);
              }}
              // 音频 clip resize 约束：只允许缩短或恢复到素材原始时长，不允许拉长超出素材
              onActionResizing={({ action, start, end, dir }) => {
                const clip: Clip | undefined = clipById[action.id];
                if (!clip || clip.kind !== "audio") return;
                const asset = project?.assets.find(
                  (a) => a.id === clip.assetId
                );
                const assetDuration = asset?.duration ?? clip.end - clip.start;
                const inPoint = clip.inPoint ?? 0;
                const outPoint = clip.outPoint ?? assetDuration;
                if (dir === "left") {
                  const newInPoint = inPoint + (start - clip.start);
                  if (newInPoint < -1e-6) return false;
                } else {
                  const newOutPoint = outPoint + (end - clip.end);
                  if (newOutPoint > assetDuration + 1e-6) return false;
                }
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
              onScroll={handleTimelineScroll}
              // 区域点击回调，跳到指定时间并暂停播放，需多处更新本地及全局播放状态
              onClickTimeArea={handleClickTimeArea}
              // 点击轨道行空白处：同样跳到该位置时间并暂停（时间线跟着动）
              onClickRow={handleClickRow}
              // 仅点击 clip 时：切换选中态（库会根据 selected 在 action 根节点加 class）
              onClickActionOnly={handleClickActionOnly}
              // 双击 clip：将播放头定位到双击位置
              onDoubleClickAction={(_e, { time }) => {
                handleClickTimeArea(time);
              }}
              // 启用轨道行拖拽，拖拽结束后按新顺序写回 project.tracks 的 order
              enableRowDrag={true}
              onRowDragEnd={({ editorData: nextEditorData }) => {
                const orderedTrackIds = nextEditorData.map((row) => row.id);
                reorderTracks(orderedTrackIds);
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
