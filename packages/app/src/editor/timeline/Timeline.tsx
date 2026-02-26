import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TimelineState } from "@vitecut/timeline";
import { ReactTimeline } from "@vitecut/timeline";
import type { Clip } from "@vitecut/project";
import { Button } from "@radix-ui/themes";
import { Tooltip } from "@/components/Tooltip";
import {
  Eye,
  EyeOff,
  LockKeyhole,
  LockKeyholeOpen,
  Volume2,
  VolumeX,
} from "lucide-react";
import { PlaybackControls } from "./playbackControls/PlaybackControls";
import { useProjectStore } from "@/stores";
import { formatTime, formatTimeLabel } from "@vitecut/utils";
import { useTimelineHotkeys } from "@vitecut/hotkeys";
import { playbackClock } from "@/editor/preview/playbackClock";
import { useVideoThumbnails, getThumbCellsForClip } from "./useVideoThumbnails";
import { useAudioWaveform, getWaveformDataUrl } from "./useAudioWaveform";
import "./Timeline.css";

/** 轨道前置列宽度（音量按钮列），与 @vitecut/timeline 的 rowPrefixWidth 一致 */
const TIMELINE_ROW_PREFIX_WIDTH_PX = 125;

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
  const toggleTrackLocked = useProjectStore((s) => s.toggleTrackLocked);
  const toggleTrackHidden = useProjectStore((s) => s.toggleTrackHidden);
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
  /** 整个 Timeline 根容器，用于阻止在该区域内的浏览器缩放（Ctrl/Cmd+滚轮、触控板捏合） */
  const timelineRootRef = useRef<HTMLDivElement | null>(null);
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
  /** 第三方时间轴的网格吸附（gridSnap），默认关闭 */
  const [gridSnapEnabled, setGridSnapEnabled] = useState(false);
  /** 第三方时间轴的辅助时间线吸附（dragLine） */
  const [dragLineEnabled, setDragLineEnabled] = useState(true);

  const SCALE_STEPS = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600];
  const MIN_TICK_WIDTH_PX = 60;

  /**
   * 计算当前合适的主刻度单位以及对应实际宽度
   */
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

  /** 计算主刻度内部分隔数 */
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
   * 构建 timeline 渲染所需 editorData 数据结构
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
          selected: selectedClipId === clip.id, // 选中态
        };
        return base;
      }),
    }));
  }, [project, selectedClipId]);

  /**
   * 构建 effect map：将 assetId 映射为 {id, name}，用于 timeline 显示素材关联
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
   * 每条轨道左侧锁定/隐藏/音量按钮：
   * - 锁定图标：控制 track.locked，锁定后该轨道不可编辑
   * - 眼睛图标：控制 track.hidden，隐藏后预览不渲染该轨道，并整体降不透明度
   * - 音量图标：控制 track.muted，静音时按钮为主题色，未静音为灰色
   */
  const renderRowPrefix = useCallback(
    (row: { id: string }) => {
      const track = project?.tracks.find((t) => t.id === row.id);
      const muted = track?.muted ?? false;
      const locked = track?.locked ?? false;
      const hidden = track?.hidden ?? false;
      const hasAudioContent = track?.clips.some(
        (c) => c.kind === "video" || c.kind === "audio"
      );
      return (
        <div
          className="timeline-track-volume-cell"
          style={{ height: TIMELINE_TRACK_CONTENT_HEIGHT_PX }}
        >
          <Tooltip content={locked ? "解锁轨道" : "锁定轨道"}>
            <Button
              color={locked ? "blue" : "gray"}
              variant="soft"
              size="1"
              className="timeline-track-volume-btn"
              aria-label={locked ? "解锁轨道" : "锁定轨道"}
              onClick={(e) => {
                e.stopPropagation();
                toggleTrackLocked(row.id);
              }}
            >
              {locked ? (
                <LockKeyhole size={16} />
              ) : (
                <LockKeyholeOpen size={16} />
              )}
            </Button>
          </Tooltip>
          <Tooltip content={hidden ? "显示轨道" : "隐藏轨道"}>
            <Button
              color={hidden ? "blue" : "gray"}
              variant="soft"
              size="1"
              className="timeline-track-volume-btn"
              aria-label={hidden ? "显示轨道" : "隐藏轨道"}
              onClick={(e) => {
                e.stopPropagation();
                toggleTrackHidden(row.id);
              }}
            >
              {hidden ? <EyeOff size={16} /> : <Eye size={16} />}
            </Button>
          </Tooltip>
          {hasAudioContent ? (
            <Tooltip content={muted ? "开启原声" : "关闭原声"}>
              <Button
                color={muted ? "blue" : "gray"}
                variant="soft"
                size="1"
                className="timeline-track-volume-btn"
                aria-label={muted ? "开启原声" : "关闭原声"}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleTrackMuted(row.id);
                }}
              >
                {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </Button>
            </Tooltip>
          ) : (
            <Button
              color="gray"
              variant="soft"
              size="1"
              className="timeline-track-volume-btn"
              aria-hidden="true"
              style={{ visibility: "hidden" }}
            />
          )}
        </div>
      );
    },
    [project?.tracks, toggleTrackLocked, toggleTrackMuted, toggleTrackHidden]
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
    const track = project.tracks.find((t) => t.id === clip.trackId);
    const locked = track?.locked ?? false;
    const hidden = track?.hidden ?? false;
    const asset = project.assets.find((a) => a.id === clip.assetId);

    // 渲染素材加载中的占位
    if (asset?.loading) {
      const rawName = asset.name ?? "媒体";
      const name = rawName.replace(/\.[^.]+$/, "") || rawName;
      return (
        <div
          className="vitecut-timeline-loading-clip"
          data-vitecut-clip
          data-vitecut-clip-locked={locked ? "true" : undefined}
          data-vitecut-track-hidden={hidden ? "true" : undefined}
        >
          <span className="vitecut-timeline-loading-clip__spinner" />
          <span className="vitecut-timeline-loading-clip__label">{name}</span>
        </div>
      );
    }

    // 渲染文本类型
    if (clip.kind === "text") {
      const asset = project.assets.find((a) => a.id === clip.assetId);
      const params = (clip.params ?? {}) as { text?: string };
      const text = params.text ?? asset?.textMeta?.initialText ?? "标题文字";
      return (
        <div
          className={`vitecut-timeline-text-clip${
            locked ? " vitecut-timeline-clip--locked" : ""
          }${hidden ? " vitecut-timeline-clip--hidden" : ""}`}
          data-vitecut-clip
          data-vitecut-clip-locked={locked ? "true" : undefined}
          data-vitecut-track-hidden={hidden ? "true" : undefined}
        >
          <span className="vitecut-timeline-text-clip__label">{text}</span>
        </div>
      );
    }

    // 渲染图片类型
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
          className={`vitecut-timeline-image-clip${
            locked ? " vitecut-timeline-clip--locked" : ""
          }${hidden ? " vitecut-timeline-clip--hidden" : ""}`}
          data-vitecut-clip
          data-vitecut-clip-locked={locked ? "true" : undefined}
          data-vitecut-track-hidden={hidden ? "true" : undefined}
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

    // 渲染音频类型
    if (clip.kind === "audio") {
      const asset = project.assets.find((a) => a.id === clip.assetId);
      const rawName = asset?.name ?? "音频";
      const name = rawName.replace(/\.[^.]+$/, "") || rawName;
      const clipDuration = Math.max(0, clip.end - clip.start);
      const durationLabel = formatTime(clipDuration);
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
          className={`vitecut-timeline-audio-clip${
            waveformUrl ? " vitecut-timeline-audio-clip--has-waveform" : ""
          }${locked ? " vitecut-timeline-clip--locked" : ""}${
            hidden ? " vitecut-timeline-clip--hidden" : ""
          }`}
          data-vitecut-clip
          data-vitecut-clip-locked={locked ? "true" : undefined}
          data-vitecut-track-hidden={hidden ? "true" : undefined}
        >
          {waveformUrl ? (
            <>
              <img
                className="vitecut-timeline-audio-clip__waveform"
                src={waveformUrl}
                alt=""
                draggable={false}
              />
              <span className="vitecut-timeline-audio-clip__label">
                <span className="vitecut-timeline-audio-clip__label-name">
                  {name}
                </span>
                <span className="vitecut-timeline-audio-clip__label-duration">
                  {durationLabel}
                </span>
              </span>
            </>
          ) : (
            <>
              <div className="vitecut-timeline-audio-clip__icon">
                <Volume2 size={14} />
              </div>
              <span className="vitecut-timeline-audio-clip__label">
                <span className="vitecut-timeline-audio-clip__label-name">
                  {name}
                </span>
                <span className="vitecut-timeline-audio-clip__label-duration">
                  {durationLabel}
                </span>
              </span>
            </>
          )}
        </div>
      );
    }

    // 渲染视频类型
    if (clip.kind !== "video") {
      return undefined;
    }
    const assetThumb = videoThumbnails[clip.assetId];

    // 视频 clip 预览图生成中时，展示 loading 占位状态
    if (assetThumb?.status === "loading") {
      const rawName = asset?.name ?? "视频";
      const name = rawName.replace(/\.[^.]+$/, "") || rawName;
      return (
        <div
          className="vitecut-timeline-loading-clip"
          data-vitecut-clip
          data-vitecut-clip-locked={locked ? "true" : undefined}
          data-vitecut-track-hidden={hidden ? "true" : undefined}
        >
          <span className="vitecut-timeline-loading-clip__spinner" />
          <span className="vitecut-timeline-loading-clip__label">
            正在生成预览图 · {name}
          </span>
        </div>
      );
    }

    // 生成缩略图单元
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
    const rawName = asset?.name ?? "视频";
    const name = rawName;
    const clipDuration = Math.max(0, clip.end - clip.start);
    const durationLabel = formatTime(clipDuration);
    return (
      <div
        className={`vitecut-timeline-video-clip__thumbs${
          locked ? " vitecut-timeline-clip--locked" : ""
        }${hidden ? " vitecut-timeline-clip--hidden" : ""}`}
        data-vitecut-clip
        data-vitecut-clip-locked={locked ? "true" : undefined}
        data-vitecut-track-hidden={hidden ? "true" : undefined}
        style={
          {
            "--thumb-aspect-ratio": aspectRatio,
          } as React.CSSProperties
        }
      >
        <div className="vitecut-timeline-video-clip__label">
          <span className="vitecut-timeline-video-clip__label-name">{name}</span>
          <span className="vitecut-timeline-video-clip__label-duration">
            {durationLabel}
          </span>
        </div>
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
   * 跳转到指定时间并暂停播放，同时同步本地与全局播放状态。
   * - `clearSelection` 为 true 时会取消选中 clip（例如点击轨道空白/背景）
   * - 为 false 时保留当前选中 clip（例如点击刻度时间区域）
   * 时间限制在 [0, duration]，从 store 读取 duration 避免闭包陈旧。
   */
  const jumpToTime = useCallback(
    (time: number, options?: { clearSelection?: boolean }) => {
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
      if (options?.clearSelection) {
        setSelectedClipId(null);
      }
      return false;
    },
    [
      setIsPlaying,
      setCurrentTime,
      setCurrentTimeGlobal,
      setIsPlayingGlobal,
      setSelectedClipId,
    ]
  );

  /** 点击刻度时间区域：仅移动时间线，不取消选中 clip。
   * 注意：签名需与第三方库 onClickTimeArea(time, event) 一致。
   * 为避免事件继续冒泡到外层 timeline 容器导致二次处理，这里会短暂设置 suppressNextTimeJumpRef。
   */
  const handleClickTimeArea = useCallback(
    (
      time: number,
      _event: React.MouseEvent<HTMLDivElement, MouseEvent>
    ): boolean => {
      jumpToTime(time, { clearSelection: false });
      suppressNextTimeJumpRef.current = true;
      window.setTimeout(() => {
        suppressNextTimeJumpRef.current = false;
      }, 0);
      return false;
    },
    [jumpToTime]
  );

  /** 点击时间轴背景/轨道空白：移动时间线并取消选中 clip */
  const handleClickTimeAreaWithClearSelection = useCallback(
    (time: number) => jumpToTime(time, { clearSelection: true }),
    [jumpToTime]
  );

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
    handleClickTimeAreaWithClearSelection(param.time);
  };

  /**
   * 同步时间轴内容区的横向 scrollLeft
   */
  const handleTimelineScroll = useCallback((params: { scrollLeft: number }) => {
    timelineScrollLeftRef.current = params.scrollLeft;
  }, []);

  /**
   * 处理时间轴容器空白处点击，根据 clientX 换算时间并跳转
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
      handleClickTimeAreaWithClearSelection(time);
    },
    [editorData.length, handleClickTimeAreaWithClearSelection, pxPerSecond]
  );

  /**
   * 仅点击 clip（不包含拖拽）：选中该 clip；锁定轨道上的 clip 不可被选中
   */
  const handleClickActionOnly = (
    _e: React.MouseEvent,
    { action }: { action: { id: string } }
  ) => {
    if (!project) return;
    const clip: Clip | undefined = clipById[action.id];
    if (!clip) return;
    const track = project.tracks.find((t) => t.id === clip.trackId);
    if (track?.locked) {
      return;
    }
    requestAnimationFrame(() => {
      setSelectedClipId(action.id);
    });
  };

  /**
   * 处理播放/暂停切换逻辑，仅更新 UI 跟全局 store，不直接操作媒体播放
   */
  const handleTogglePlay = () => {
    const timelineState = timelineRef.current;
    if (!timelineState) {
      return;
    }

    if (isPlaying) {
      // 暂停
      const t = playbackClock.currentTime;
      setCurrentTime(t);
      setCurrentTimeGlobal(t);
      timelineState.pause();
      setIsPlaying(false);
      setIsPlayingGlobal(false);
    } else {
      // 播到末尾后重新从头播放
      const end = duration;
      const t = useProjectStore.getState().currentTime;
      if (end > 0 && t >= end) {
        timelineState.setTime(0);
        setCurrentTime(0);
        setCurrentTimeGlobal(0);
      }
      setIsPlaying(true);
      setIsPlayingGlobal(true);
    }
  };

  /**
   * 单步跳转到时间轴开头，暂停播放
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
   * 单步跳转到时间轴末尾，暂停播放
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
   * 拖动播放头时，只实时刷新本地 currentTime，不同步到全局 store
   * 提升拖动响应性能
   */
  const handleCursorDrag = (time: number) => {
    setCurrentTime(time);
  };

  /**
   * 拖动播放头松手时，将当前时间同步到全局 store
   */
  const handleCursorDragEnd = (time: number) => {
    setCurrentTime(time);
    setCurrentTimeGlobal(time);
  };

  /**
   * 时间轴缩小（scaleWidth 变小，刻度间距缩短）
   */
  const handleZoomOut = () => {
    setPxPerSecond((prev) => Math.max(prev / 1.25, 1));
  };

  /**
   * 时间轴放大（scaleWidth 变大，刻度间距变宽）
   */
  const handleZoomIn = () => {
    setPxPerSecond((prev) => Math.min(prev * 1.25, 500));
  };

  /**
   * 触控板捏合 / Cmd+滚轮 缩放时间轴
   * Mac 平台上 ctrlKey=true，或使用 command+滚轮
   */
  const handleWheelZoom = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    if (!e.ctrlKey && !e.metaKey) {
      return;
    }
    e.preventDefault();
    const isZoomOut = e.deltaY > 0;
    const factor = isZoomOut ? 1 / 1.02 : 1.02;
    setPxPerSecond((prev) => Math.min(500, Math.max(1, prev * factor)));
  }, []);

  /**
   * 让全部时长刚好适配到当前可见区宽度
   * 刻度间距有最小最大限制
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
    timelineState?.setScrollLeft(0);
  };

  /**
   * 向左裁剪选中 clip（并限制裁剪边界）
   */
  const handleTrimClipLeft = () => {
    if (!selectedClipId) return;
    const clip = clipById[selectedClipId];
    if (!clip) return;
    if (currentTime <= clip.start || currentTime >= clip.end) return;
    trimClipLeft(selectedClipId);
  };

  /**
   * 向右裁剪选中 clip（并限制裁剪边界）
   */
  const handleTrimClipRight = () => {
    if (!selectedClipId) return;
    const clip = clipById[selectedClipId];
    if (!clip) return;
    if (currentTime <= clip.start || currentTime >= clip.end) return;
    trimClipRight(selectedClipId);
  };

  /**
   * 对选中 clip 进行剪切
   */
  const handleCutSelectedClip = () => {
    if (!selectedClipId) return;
    const clip = clipById[selectedClipId];
    if (!clip) return;
    if (currentTime <= clip.start || currentTime >= clip.end) return;
    cutClip(selectedClipId);
  };

  /**
   * 对选中 clip 进行复制
   */
  const handleCopySelectedClip = () => {
    if (!selectedClipId) return;
    duplicateClip(selectedClipId);
  };

  /**
   * 对选中 clip 进行删除
   */
  const handleDeleteSelectedClip = () => {
    if (!selectedClipId) return;
    deleteClip(selectedClipId);
    setSelectedClipId(null);
  };

  /** 当前选中的 clip 数据 */
  const selectedClip =
    selectedClipId != null ? clipById[selectedClipId] : undefined;

  /**
   * 判断当前时间是否处于选中 clip 内部（可操作区间）
   */
  const canOperateOnSelectedClip = () => {
    if (!selectedClip) return false;
    return currentTime > selectedClip.start && currentTime < selectedClip.end;
  };

  /**
   * 拖动前判断该轨道是否允许移动（锁定不允许移动）
   */
  const handleActionMoving = ({ row }: { row: { id: string } }) => {
    if (!project) return false;
    const track = project.tracks.find((t) => t.id === row.id);
    if (track?.locked) {
      return false;
    }
    return true;
  };

  /**
   * 移动 clip 拖拽结束后，更新 clip 的位置及轨道，并处理一次点击抑制
   */
  const handleActionMoveEnd = (params: {
    action: { id: string };
    row: { id: string };
    start: number;
    end: number;
  }) => {
    const { action, row, start, end } = params;
    if (!project) return;
    const track = project.tracks.find((t) => t.id === row.id);
    if (!track || track.locked) {
      return;
    }
    updateClipTiming(action.id, start, end, row.id);
    setSelectedClipId(action.id);
    // 拖拽误点防抖
    suppressNextTimeJumpRef.current = true;
    window.setTimeout(() => {
      suppressNextTimeJumpRef.current = false;
    }, 200);
  };

  /**
   * 音频 clip 拖拽 resize 时，校验是否在允许缩放区间范围内
   */
  const handleActionResizing = (params: {
    action: { id: string };
    start: number;
    end: number;
    dir: "left" | "right";
  }) => {
    const { action, start, end, dir } = params;
    const clip: Clip | undefined = clipById[action.id];
    if (!clip) return;
    if (project) {
      const track = project.tracks.find((t) => t.id === clip.trackId);
      if (track?.locked) {
        return false;
      }
    }
    if (clip.kind !== "audio") return;
    const asset = project?.assets.find((a) => a.id === clip.assetId);
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
    return true;
  };

  /**
   * resize 拖拽结束后，写回更新后的 clip 起止时间
   */
  const handleActionResizeEnd = (params: {
    action: { id: string };
    row: { id: string };
    start: number;
    end: number;
    dir: "left" | "right";
  }) => {
    const { action, row, start, end, dir } = params;
    if (!project) return;
    const track = project.tracks.find((t) => t.id === row.id);
    if (!track || track.locked) {
      return;
    }
    const clip: Clip | undefined = clipById[action.id];
    if (!clip) return;
    const nextStart = dir === "left" ? start : clip.start;
    const nextEnd = dir === "left" ? clip.end : end;
    updateClipTiming(action.id, nextStart, nextEnd, row.id);
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

  /**
   * 使用 timeline 区域的全局快捷键
   */
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
   * 在 Timeline 区域内阻止浏览器默认缩放行为（页面缩放）
   * 捕获全局 wheel 事件，若发生在 timelineRootRef 内且按下 Ctrl/Meta，则阻止默认
   */
  useEffect(() => {
    /**
     * wheel 事件处理函数
     */
    const handleGlobalWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      const root = timelineRootRef.current;
      if (!root) return;
      if (!root.contains(e.target as Node)) return;
      e.preventDefault();
    };
    window.addEventListener("wheel", handleGlobalWheel, {
      passive: false,
    });
    return () => {
      window.removeEventListener("wheel", handleGlobalWheel);
    };
  }, []);

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
   * 由全局播放时钟（playbackClock）驱动 timeline 播放头位置；
   * 用 requestAnimationFrame 保证播放期间的平滑性；
   * 当到达时长末尾时自动停止
   */
  useEffect(() => {
    if (!isPlaying) {
      return;
    }

    let frameId: number | null = null;

    /**
     * 播放时同步 UI 状态并循环 rAF
     */
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
    <div className="app-editor-layout__timeline" ref={timelineRootRef}>
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
        gridSnapEnabled={gridSnapEnabled}
        dragLineEnabled={dragLineEnabled}
        onGridSnapChange={setGridSnapEnabled}
        onDragLineChange={setDragLineEnabled}
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
            onWheelCapture={handleWheelZoom}
            role="presentation"
          >
            <ReactTimeline
              ref={timelineRef}
              // @ts-ignore: 第三方库未导出 TS 类型。后续有风险请逐步替换。
              editorData={editorData as any}
              // 轨道关联资源字典，key为素材assetId，value为{id, name}
              effects={effects as any}
              style={{ width: "100%", height: "100%" }}
              // 是否启用网格吸附（拖动clip时吸附到刻度线）
              gridSnap={gridSnapEnabled}
              // 是否启用拖拽辅助线（拖动clip时显示辅助线）
              dragLine={dragLineEnabled}
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
              // 拖拽移动过程中：若轨道已锁定则直接阻止移动
              onActionMoving={handleActionMoving}
              // 拖拽移动 clip 结束后：写回 start/end（若轨道未锁定）
              onActionMoveEnd={handleActionMoveEnd}
              // 音频 clip resize 约束：只允许缩短或恢复到素材原始时长，不允许拉长超出素材
              onActionResizing={handleActionResizing}
              // 改变 clip 长度结束后：写回 start/end（例如裁剪时长），锁定轨道则忽略
              // - 左侧 resize：只改变起始时间，结束时间保持不变
              // - 右侧 resize：只改变结束时间，起始时间保持不变
              onActionResizeEnd={handleActionResizeEnd}
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
                // 双击同样仅移动时间线，不取消选中 clip
                jumpToTime(time, { clearSelection: false });
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
