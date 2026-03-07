import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Timeline as ReactTimeline,
  pixelToTime,
  timeToPixel,
  type TimelineRow,
  type TimelineState,
} from "@vitecut/timeline";
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
import {
  PlaybackControls,
  type TimelineSettingsConfig,
} from "./playbackControls/PlaybackControls";
import { useProjectStore } from "@/stores";
import { formatTime } from "@vitecut/utils";
import { useTimelineHotkeys } from "@vitecut/hotkeys";
import { playbackClock } from "@/editor/preview/playbackClock";
import { useVideoThumbnails, getThumbCellsForClip } from "./useVideoThumbnails";
import { useAudioWaveform, getWaveformDataUrl } from "./useAudioWaveform";
import { useTimelinePlaybackSync } from "./useTimelinePlaybackSync";
import "./Timeline.css";

/** 轨道前置列宽度（音量按钮列），与 @vitecut/timeline 的 rowPrefixWidth 一致 */
const TIMELINE_ROW_PREFIX_WIDTH_PX = 180;
/** 时间轴结尾留白像素 */
const TIMELINE_END_PADDING_PX = 240;
/** 时间轴最小缩放比例 */
const MIN_ZOOM = 0.1;
/** 时间轴最大缩放比例 */
const MAX_ZOOM = 8;
/** 默认的时间轴设置配置 */
const DEFAULT_TIMELINE_SETTINGS_CONFIG: TimelineSettingsConfig = {
  dragSnapToClipEdges: true,
  dragSnapToTimelineTicks: false,
  trimSnapToClipEdges: true,
  trimSnapToTimelineTicks: false,
  showMinorTicks: false,
  showHorizontalLines: true,
};

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
/** 时间轴轨道类型别名对应的预设高度表 */
const TRACK_HEIGHT_PRESETS = {
  main: 50,
  video: 40,
  audio: 30,
  image: 40,
  text: 30,
  solid: 40,
};

/** Timeline timeline 相关样式类名 */
const TIMELINE_CLASS_NAMES = {
  root: "vitecut-timeline-root",
  trackPanel: "vitecut-timeline-track-panel",
  trackRow: (row: TimelineRow) => {
    const classes = ["vitecut-timeline-track-row"];
    const role =
      typeof row.role === "string" && row.role.length > 0 ? row.role : "normal";
    classes.push(`vitecut-timeline-track-row--${role}`);
    if (row.locked === true) {
      classes.push("vitecut-timeline-track-row--locked");
    }
    if (row.hidden === true) {
      classes.push("vitecut-timeline-track-row--hidden");
    }
    return classes.join(" ");
  },
  clip: "vitecut-timeline-clip",
  dragPreview: "vitecut-timeline-drag-preview",
} as const;

/**
 * 渲染时间轴左侧轨道面板头部品牌区。
 */
function renderTrackPanelHeader() {
  return (
    <a
      className="vitecut-timeline-brand-link"
      href="https://timeline.vitecut.com/"
      target="_blank"
      rel="noreferrer"
    >
      <img
        className="vitecut-timeline-brand-link__icon"
        src="https://timeline.vitecut.com/favicon.png"
        alt=""
        aria-hidden="true"
      />
      <span>Powered by ViteCut Timeline</span>
    </a>
  );
}

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
  const moveClipToNewTrack = useProjectStore((s) => s.moveClipToNewTrack);
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
  /** 标记下一次背景点击是否需要抑制（用于拖拽 clip 结束后的误触） */
  const suppressNextTimeJumpRef = useRef(false);

  /** 播放状态 */
  const [isPlaying, setIsPlaying] = useState(false);
  /** 当前播放时间（秒） */
  const [currentTime, setCurrentTime] = useState(0);
  /** 时间轴缩放比例 */
  const [zoom, setZoom] = useState(1);
  /** 时间轴设置配置 */
  const [timelineSettingsConfig, setTimelineSettingsConfig] =
    useState<TimelineSettingsConfig>(DEFAULT_TIMELINE_SETTINGS_CONFIG);
  /** 当前时间轴区域舞台宽度(px)，由resize监听实时更新 */
  const [stageWidth, setStageWidth] = useState(0);
  /** 当前每秒对应像素（用于渲染缩略图宽度、判断缩放等级） */
  const pxPerSecond = useMemo(() => timeToPixel(1, zoom), [zoom]);

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

    // 排序规则：非音频轨道最上，主轨道居中，音频轨道位于主轨道下方。
    const mainTrack =
      project.tracks.find((track) => track.name === "主轨道") ??
      project.tracks.find((track) => track.kind !== "audio") ??
      project.tracks[0];
    const sortedTracks = [...project.tracks].sort((a, b) => {
      const rank = (track: (typeof project.tracks)[number]) => {
        if (mainTrack && track.id === mainTrack.id) return 1;
        if (track.kind === "audio") return 2;
        return 0;
      };
      const rankA = rank(a);
      const rankB = rank(b);
      if (rankA !== rankB) return rankA - rankB;
      return b.order - a.order;
    });
    return sortedTracks.map((track) => ({
      id: track.id,
      role:
        mainTrack && track.id === mainTrack.id
          ? "main"
          : track.kind === "audio"
            ? "audio"
            : "normal",
      hidden: track.hidden ?? false,
      locked: track.locked ?? false,
      actions: track.clips.map((clip) => {
        const base = {
          id: clip.id,
          start: clip.start,
          end: clip.end,
          effectId: clip.assetId, // 关联素材
          selected: selectedClipId === clip.id, // 选中态
          kind: clip.kind,
        };
        return base;
      }),
    }));
  }, [project, selectedClipId]);

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

  /** 项目内容最后一个 clip 的结束时间 */
  const lastClipEnd = useMemo(() => {
    if (!project) {
      return 0;
    }
    let maxEnd = 0;
    for (const track of project.tracks) {
      for (const clip of track.clips) {
        maxEnd = Math.max(maxEnd, clip.end);
      }
    }
    return maxEnd;
  }, [project]);

  /** 时间轴展示时长（内容末尾 + 留白 + 至少撑满视口） */
  const timelineDuration = useMemo(() => {
    const paddingSeconds = pixelToTime(TIMELINE_END_PADDING_PX, zoom);
    const durationWithPadding = lastClipEnd + paddingSeconds;
    const mainViewportWidth = Math.max(
      0,
      stageWidth - TIMELINE_ROW_PREFIX_WIDTH_PX
    );
    const minDurationForViewport = pixelToTime(mainViewportWidth, zoom);
    return Math.max(1, duration, durationWithPadding, minDurationForViewport);
  }, [duration, lastClipEnd, stageWidth, zoom]);

  /**
   * 每条轨道左侧锁定/隐藏/音量按钮：
   * - 锁定图标：控制 track.locked，锁定后该轨道不可编辑
   * - 眼睛图标：控制 track.hidden，隐藏后预览不渲染该轨道，并整体降不透明度
   * - 音量图标：控制 track.muted，静音时按钮为主题色，未静音为灰色
   */
  const renderTrackControls = useCallback(
    (row: { id: string }) => {
      const track = project?.tracks.find((t) => t.id === row.id);
      const hasTrack = !!track;
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
          {/* 锁定轨道按钮 */}
          <Tooltip content={locked ? "解锁轨道" : "锁定轨道"}>
            <Button
              color={locked ? "blue" : "gray"}
              variant="soft"
              size="1"
              className="timeline-track-volume-btn"
              aria-label={locked ? "解锁轨道" : "锁定轨道"}
              disabled={!hasTrack}
              onClick={(e) => {
                e.stopPropagation();
                if (!hasTrack) return;
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
          {/* 显示/隐藏轨道按钮 */}
          <Tooltip content={hidden ? "显示轨道" : "隐藏轨道"}>
            <Button
              color={hidden ? "blue" : "gray"}
              variant="soft"
              size="1"
              className="timeline-track-volume-btn"
              aria-label={hidden ? "显示轨道" : "隐藏轨道"}
              disabled={!hasTrack}
              onClick={(e) => {
                e.stopPropagation();
                if (!hasTrack) return;
                toggleTrackHidden(row.id);
              }}
            >
              {hidden ? <EyeOff size={16} /> : <Eye size={16} />}
            </Button>
          </Tooltip>
          {/* 静音按钮 */}
          {hasAudioContent ? (
            <Tooltip content={muted ? "开启原声" : "关闭原声"}>
              <Button
                color={muted ? "blue" : "gray"}
                variant="soft"
                size="1"
                className="timeline-track-volume-btn"
                aria-label={muted ? "开启原声" : "关闭原声"}
                disabled={!hasTrack}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!hasTrack) return;
                  toggleTrackMuted(row.id);
                }}
              >
                {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </Button>
            </Tooltip>
          ) : (
            // 占位按钮
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
    [project?.tracks, toggleTrackHidden, toggleTrackLocked, toggleTrackMuted]
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
      return (
        <div
          className={`vitecut-timeline-image-clip${
            locked ? " vitecut-timeline-clip--locked" : ""
          }${hidden ? " vitecut-timeline-clip--hidden" : ""}`}
          data-vitecut-clip
          data-vitecut-clip-locked={locked ? "true" : undefined}
          data-vitecut-track-hidden={hidden ? "true" : undefined}
          style={{ backgroundImage: `url(${source})` }}
        />
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
              {/* 渲染音频波形图 */}
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
              {/* 占位音频图标 */}
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
          <span className="vitecut-timeline-video-clip__label-name">
            {name}
          </span>
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
    // 判断事件是否发生在 clip 区域，若是则忽略，防止背景的时间线跳转冲突
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
   * 仅点击 clip（不包含拖拽）：选中该 clip；锁定轨道上的 clip 不可被选中
   */
  const handleClickActionOnly = (
    _e: React.MouseEvent,
    { action }: { action: { id: string } }
  ) => {
    if (!project) return;
    const clip: Clip | undefined = clipById[action.id];
    if (!clip) {
      return;
    }
    const track = project.tracks.find((t) => t.id === clip.trackId);
    if (track?.locked) {
      return;
    }
    // 通过 requestAnimationFrame，使得在事件冒泡后再设置选中，避免状态更新和冒泡时的干扰
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
    /**
     * 播放中由外层播放循环驱动时间头，忽略 timeline 内部 setTime 触发的 onCursorDrag，
     * 避免每帧回调再次 setState 导致抖动。
     */
    if (isPlaying) {
      return;
    }
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
    setZoom((prev) => Math.max(MIN_ZOOM, prev / 1.2));
  };

  /**
   * 时间轴放大（scaleWidth 变大，刻度间距变宽）
   */
  const handleZoomIn = () => {
    setZoom((prev) => Math.min(MAX_ZOOM, prev * 1.2));
  };

  /**
   * 让全部时长刚好适配到当前可见区宽度
   * 刻度间距有最小最大限制
   */
  const handleFitToView = () => {
    const container = timelineContainerRef.current;
    if (!container || duration <= 0) {
      return;
    }
    const width = Math.max(
      0,
      container.clientWidth - TIMELINE_ROW_PREFIX_WIDTH_PX
    );
    const targetPxPerSecond = width / Math.max(duration, 1);
    setZoom((prev) => {
      const currentPxPerSecond = Math.max(1e-6, timeToPixel(1, prev));
      const ratio = targetPxPerSecond / currentPxPerSecond;
      return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev * ratio));
    });
    const timelineState = timelineRef.current;
    timelineState?.setScrollLeft(0);
  };

  /**
   * 在捕获阶段拦截 Ctrl/Cmd + 滚轮缩放，避免冒泡到第三方 onWheel 触发 passive 警告
   */
  const handleWheelZoomCapture = (e: React.WheelEvent<HTMLDivElement>) => {
    if (!e.ctrlKey && !e.metaKey) {
      return;
    }

    e.stopPropagation();

    // 查找时间轴滚动容器
    const scrollHost =
      timelineContainerRef.current?.querySelector<HTMLElement>(
        ".timeline-scroll"
      );
    if (!scrollHost) {
      return;
    }

    const rect = scrollHost.getBoundingClientRect();
    const anchorOffset = e.clientX - rect.left;
    const anchorPixel = anchorOffset + scrollHost.scrollLeft;
    const anchorTime = pixelToTime(anchorPixel, zoom);
    const nextZoom = Math.min(
      MAX_ZOOM,
      Math.max(MIN_ZOOM, zoom * (e.deltaY > 0 ? 0.9 : 1.1))
    );
    if (nextZoom === zoom) {
      return;
    }

    setZoom(nextZoom);
    requestAnimationFrame(() => {
      const nextAnchorPixel = timeToPixel(anchorTime, nextZoom);
      scrollHost.scrollLeft = Math.max(0, nextAnchorPixel - anchorOffset);
    });
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
  const handleActionMoving = ({
    row,
    targetRowId,
  }: {
    row: { id: string };
    targetRowId?: string;
  }) => {
    if (!project) return false;
    const track = project.tracks.find((t) => t.id === row.id);
    if (track?.locked) {
      return false;
    }
    if (targetRowId) {
      const targetTrack = project.tracks.find((t) => t.id === targetRowId);
      if (targetTrack?.locked) {
        return false;
      }
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
    targetRowId?: string;
    insertRowIndex?: number | null;
  }) => {
    const { action, row, start, end, targetRowId, insertRowIndex } = params;
    if (!project) return;
    if (insertRowIndex != null) {
      moveClipToNewTrack(action.id, start, end, insertRowIndex);
      setSelectedClipId(action.id);
      suppressNextTimeJumpRef.current = true;
      window.setTimeout(() => {
        suppressNextTimeJumpRef.current = false;
      }, 200);
      return;
    }
    const nextRowId = targetRowId ?? row.id;
    const track = project.tracks.find((t) => t.id === nextRowId);
    if (!track || track.locked) {
      return;
    }
    updateClipTiming(action.id, start, end, nextRowId);
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
      // 粘贴时，复制当前粘贴板 clip 或选中 clip
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
      capture: true,
    });
    return () => {
      window.removeEventListener("wheel", handleGlobalWheel, true);
    };
  }, []);

  useEffect(() => {
    // 监听 timeline 区域容器宽度变化，动态更新 stageWidth
    const container = timelineContainerRef.current;
    if (!container) return;
    const sync = () => setStageWidth(container.clientWidth);
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  /** 时间轴上应渲染的 currentTime，用于区分播放中（受命令式 setTime 控制）与暂停时（受 state 控制） */
  const timelineCurrentTime = useTimelinePlaybackSync({
    isPlaying,
    duration,
    currentTime,
    timelineRef,
    setCurrentTime,
    setIsPlaying,
    setIsPlayingGlobal,
  });

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
        defaultTimelineSettingsConfig={DEFAULT_TIMELINE_SETTINGS_CONFIG}
        onTimelineSettingsConfigChange={setTimelineSettingsConfig}
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
          // 主时间轴区域
          <div
            className="timeline-editor"
            ref={timelineContainerRef}
            role="presentation"
            onWheelCapture={handleWheelZoomCapture}
          >
            <ReactTimeline
              ref={timelineRef}
              editorData={editorData as any}
              duration={timelineDuration}
              playing={isPlaying}
              currentTime={timelineCurrentTime}
              showMinorTicks={timelineSettingsConfig.showMinorTicks}
              showHorizontalLines={timelineSettingsConfig.showHorizontalLines}
              dragSnapToClipEdges={timelineSettingsConfig.dragSnapToClipEdges}
              dragSnapToTimelineTicks={
                timelineSettingsConfig.dragSnapToTimelineTicks
              }
              trimSnapToClipEdges={timelineSettingsConfig.trimSnapToClipEdges}
              trimSnapToTimelineTicks={
                timelineSettingsConfig.trimSnapToTimelineTicks
              }
              minZoom={MIN_ZOOM}
              maxZoom={MAX_ZOOM}
              zoom={zoom}
              onZoomChange={setZoom}
              rowHeight={TIMELINE_TRACK_CONTENT_HEIGHT_PX}
              trackGap={TIMELINE_TRACK_GAP_PX}
              trackHeightPresets={TRACK_HEIGHT_PRESETS}
              trackControlsWidth={TIMELINE_ROW_PREFIX_WIDTH_PX}
              classNames={TIMELINE_CLASS_NAMES}
              renderTrackPanelHeader={renderTrackPanelHeader}
              renderTrackControls={renderTrackControls}
              getActionRender={getActionRender}
              onActionMoving={handleActionMoving}
              onActionMoveEnd={handleActionMoveEnd}
              onActionResizing={handleActionResizing}
              onActionResizeEnd={handleActionResizeEnd}
              onCursorDrag={handleCursorDrag}
              onCursorDragEnd={handleCursorDragEnd}
              onClickTimeArea={handleClickTimeArea}
              onClickRow={handleClickRow}
              onClickActionOnly={handleClickActionOnly}
              onDoubleClickAction={(_e, { time }) => {
                jumpToTime(time, { clearSelection: false });
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
