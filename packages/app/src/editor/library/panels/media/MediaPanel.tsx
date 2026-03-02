import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import {
  Search,
  CloudUpload,
  Maximize2,
  Plus,
  Trash2,
  Music,
  Film,
  Volume2,
  VolumeX,
  Loader2,
} from "lucide-react";
import { Dialog, Select, Popover } from "radix-ui";
import { useProjectStore } from "@/stores/projectStore";
import {
  fetchMediaList,
  deleteMedia,
  type MediaRecord,
  type MediaSource,
} from "@/api/mediaApi";
import { getRangeForTag, type TimeTag } from "@/utils/mediaStorage";
import { formatDuration, formatAddedAt } from "@/utils/format";
import { useToast } from "@/components/Toaster";
import { useAddMediaContext, useAuth, type PendingUpload } from "@/contexts";
import "./MediaPanel.css";

// =============================================================================
// 常量
// =============================================================================

/** 类型筛选项数组 */
const TYPE_OPTIONS: {
  value: "all" | "video" | "image" | "audio";
  label: string;
}[] = [
  { value: "all", label: "全部" },
  { value: "video", label: "仅视频" },
  { value: "image", label: "仅图片" },
  { value: "audio", label: "仅音频" },
];

/** 时间筛选项数组 */
const TIME_TAGS: { value: TimeTag; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "today", label: "今天" },
  { value: "yesterday", label: "昨天" },
  { value: "thisWeek", label: "本周" },
  { value: "thisMonth", label: "本月" },
];

/**
 * 获取媒体来源对应的标签显示文案
 * @param source 媒体来源
 * @returns 来源文案
 */
function getSourceLabel(source: MediaSource | undefined): string {
  switch (source) {
    case "ai":
      return "AI生成";
    case "system":
      return "系统自带";
    default:
      return "用户上传";
  }
}

/** 每页条数，与后端 limit 一致 */
const PER_PAGE = 20;

/**
 * 媒体面板：展示媒体库列表，支持筛选、分页、上传、拖拽到时间轴、预览与删除。
 */
export function MediaPanel() {
  // ---------- 列表与分页 ----------
  /** 当前媒体列表 */
  const [list, setList] = useState<MediaRecord[]>([]);
  /** 当前页数 */
  const [page, setPage] = useState(1);
  /** 查询结果总数 */
  const [totalResults, setTotalResults] = useState(0);
  /** 搜索关键字 */
  const [searchQuery, setSearchQuery] = useState("");
  /** 媒体类型筛选 */
  const [typeFilter, setTypeFilter] = useState<
    "all" | "video" | "image" | "audio"
  >("all");
  /** 时间区间筛选 */
  const [timeTag, setTimeTag] = useState<TimeTag>("all");

  // ---------- 预览、错误、UI 交互 ----------
  /** 当前预览的单条媒体信息 */
  const [previewRecord, setPreviewRecord] = useState<MediaRecord | null>(null);
  /** 加入时间轴的操作错误 */
  const [addError, setAddError] = useState<string | null>(null);
  /** 首次是否加载完成 */
  const [isInitialLoaded, setIsInitialLoaded] = useState(false);
  /** 是否正在加载 */
  const [isLoading, setIsLoading] = useState(false);
  /** 是否正在加载更多 */
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  /** 加载异常信息 */
  const [loadError, setLoadError] = useState<string | null>(null);
  /** 拖拽进入状态 */
  const [isDragOver, setIsDragOver] = useState(false);
  /** 当前确认删除的项 id */
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // ---------- refs：视频/音频预览元素 ----------
  /** 鼠标悬浮的视频id */
  const [hoveredVideoId, setHoveredVideoId] = useState<string | null>(null);
  /** 视频元素集合 */
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  /** 视频预览静音状态 */
  const [isVideoPreviewMuted, setIsVideoPreviewMuted] = useState(true);
  /** 弹窗视频预览ref */
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  /** 列表音频预览ref */
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);
  /** 弹窗音频预览ref */
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  /** 音频预览静音状态 */
  const [isAudioPreviewMuted, setIsAudioPreviewMuted] = useState(true);
  /** 弹窗音频静音状态 */
  const [isDialogAudioMuted, setIsDialogAudioMuted] = useState(false);

  // ---------- Store 与 Context ----------
  /** toast 显示方法 */
  const { showToast } = useToast();
  /** 当前登录 token */
  const { token } = useAuth();
  /** 上下文方法：打开上传界面/上传文件/当前上传列表 */
  const {
    trigger: triggerAddMedia,
    loadFile: loadMediaFile,
    pendingUploads,
  } = useAddMediaContext();

  /** 添加占位媒体的方法 */
  const addMediaPlaceholder = useProjectStore((s) => s.addMediaPlaceholder);
  /** 占位媒体变正式媒体的方法 */
  const resolveMediaPlaceholder = useProjectStore(
    (s) => s.resolveMediaPlaceholder
  );
  /** 正在刷新的标记 */
  const refreshInFlightRef = useRef(false);

  // =============================================================================
  // 数据加载
  // =============================================================================

  /**
   * 分页加载媒体库数据
   * @param pageNum 页号
   * @param append 是否追加
   */
  const loadPage = useCallback(
    async (pageNum: number, append: boolean) => {
      if (!token) {
        setList([]);
        setTotalResults(0);
        setLoadError(null);
        setIsInitialLoaded(true);
        setIsLoading(false);
        setIsLoadingMore(false);
        if (!append) refreshInFlightRef.current = false;
        return;
      }
      if (refreshInFlightRef.current && !append) return;
      if (append) {
        setIsLoadingMore(true);
      } else {
        refreshInFlightRef.current = true;
        setIsLoading(true);
      }
      setLoadError(null);
      try {
        const range = getRangeForTag(timeTag);
        const { items, total } = await fetchMediaList({
          type:
            typeFilter === "all"
              ? undefined
              : (typeFilter as "video" | "image" | "audio"),
          search: searchQuery.trim() || undefined,
          page: pageNum,
          limit: PER_PAGE,
          addedAtSince: range?.[0],
          addedAtUntil: range?.[1],
        });
        setList((prev) => (append ? [...prev, ...items] : items));
        setTotalResults(total);
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : "加载失败");
        if (!append) {
          setList([]);
        }
      } finally {
        setIsInitialLoaded(true);
        if (append) {
          setIsLoadingMore(false);
        } else {
          refreshInFlightRef.current = false;
          setIsLoading(false);
        }
      }
    },
    [token, timeTag, searchQuery, typeFilter]
  );

  /**
   * 刷新媒体库列表
   */
  const refreshList = useCallback(() => {
    setPage(1);
    void loadPage(1, false);
  }, [loadPage]);

  // =============================================================================
  // 音频预览（列表项 hover 时静音播放）
  // =============================================================================

  /**
   * 获取媒体访问 url
   * @param record 媒体
   * @returns url
   */
  const getDisplayUrl = useCallback(
    (record: MediaRecord) => record.url ?? "",
    []
  );

  /**
   * 停止音频预览
   */
  const stopAudioPreview = useCallback(() => {
    if (audioPreviewRef.current) {
      audioPreviewRef.current.pause();
      audioPreviewRef.current.currentTime = 0;
    }
  }, []);

  /**
   * 开始音频预览
   * @param record 媒体
   */
  const startAudioPreview = useCallback(
    async (record: MediaRecord) => {
      if (record.type !== "audio") return;
      setIsAudioPreviewMuted(true);
      const src = getDisplayUrl(record);
      if (!src) return;
      if (!audioPreviewRef.current) {
        audioPreviewRef.current = new Audio();
        audioPreviewRef.current.addEventListener("ended", () => {});
      }
      const audio = audioPreviewRef.current;
      audio.muted = true;
      try {
        audio.pause();
        audio.src = src;
        audio.currentTime = 0;
        await audio.play();
      } catch {
        // 忽略预览播放错误
      }
    },
    [getDisplayUrl]
  );

  // =============================================================================
  // Effects：分页加载、筛选重置、刷新事件
  // =============================================================================

  /** 卸载时清理音频播放 */
  useEffect(() => {
    return () => {
      if (audioPreviewRef.current) {
        audioPreviewRef.current.pause();
        audioPreviewRef.current.src = "";
      }
    };
  }, []);

  /** 筛选变动时重置当前页为1 */
  useEffect(() => {
    setPage(1);
  }, [timeTag, typeFilter, searchQuery]);

  /** 分页加载逻辑，上传中跳过 */
  useEffect(() => {
    if (pendingUploads.length > 0) return;
    void loadPage(page, page > 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps --  intentionally omit pendingUploads.length: when it goes 1→0 (upload done), we append via vitecut-media-added and must NOT re-fetch
  }, [page, loadPage]);

  /**
   * 上传完成时追加新记录，避免整页刷新
   */
  useEffect(() => {
    const handler = (e: Event) => {
      const { record } =
        (e as CustomEvent<{ record: MediaRecord }>).detail ?? {};
      if (!record?.id) return;
      const range = getRangeForTag(timeTag);
      const typeMatch = typeFilter === "all" || record.type === typeFilter;
      const timeMatch =
        !range || (record.addedAt >= range[0] && record.addedAt <= range[1]);
      const searchMatch =
        !searchQuery.trim() ||
        record.name.toLowerCase().includes(searchQuery.trim().toLowerCase());
      if (typeMatch && timeMatch && searchMatch) {
        setList((prev) => [record, ...prev]);
      }
      setTotalResults((prev) => prev + 1);
    };
    window.addEventListener("vitecut-media-added", handler);
    return () => window.removeEventListener("vitecut-media-added", handler);
  }, [timeTag, typeFilter, searchQuery]);

  /**
   * 监听删除/其它场景触发整页刷新
   */
  useEffect(() => {
    const handler = () => {
      setPage(1);
      void loadPage(1, false);
    };
    window.addEventListener("vitecut-media-refresh", handler);
    return () => window.removeEventListener("vitecut-media-refresh", handler);
  }, [loadPage]);

  // =============================================================================
  // 衍生数据
  // =============================================================================

  /**
   * 进行一次倒序排序，最终用于渲染
   */
  const filteredList = useMemo(
    () => [...list].sort((a, b) => b.addedAt - a.addedAt),
    [list]
  );

  /**
   * 列表项类型定义
   */
  type ColumnItem =
    | { type: "uploading"; data: PendingUpload }
    | { type: "media"; data: MediaRecord };

  /** 是否有更多结果 */
  const hasMore = list.length < totalResults;
  /** 是否需要显示加载更多 */
  const showLoadMore =
    !loadError &&
    hasMore &&
    (filteredList.length > 0 || pendingUploads.length > 0);

  /**
   * 当前是否激活了筛选，用于判定是否显示“无结果”还是“空库”
   */
  const hasActiveFilters = useMemo(
    () =>
      timeTag !== "all" || typeFilter !== "all" || searchQuery.trim() !== "",
    [timeTag, typeFilter, searchQuery]
  );

  /**
   * 媒体和上传项以两列交替排布
   */
  const columns = useMemo(() => {
    const cols: ColumnItem[][] = [[], []];
    pendingUploads.forEach((p, i) => {
      cols[i % 2].push({ type: "uploading", data: p });
    });
    filteredList.forEach((record, index) => {
      cols[index % 2].push({ type: "media", data: record });
    });
    return cols;
  }, [filteredList, pendingUploads]);

  // =============================================================================
  // 事件处理：添加到时间轴、拖拽上传
  // =============================================================================

  /**
   * 添加媒体记录到时间轴
   * @param record 媒体记录
   */
  const addRecordToCanvas = useCallback(
    async (record: MediaRecord) => {
      setAddError(null);
      const ids = addMediaPlaceholder({
        name: record.name,
        kind: record.type,
        sourceUrl: record.url,
      });
      try {
        // 媒体库中的记录已有 HTTP URL，直接传入避免重复上传
        await resolveMediaPlaceholder(ids, record.url);
        setPreviewRecord(null);
      } catch (err) {
        await resolveMediaPlaceholder(ids, null);
        setAddError(err instanceof Error ? err.message : "添加失败");
      }
    },
    [addMediaPlaceholder, resolveMediaPlaceholder]
  );

  /**
   * 处理弹窗中的加入时间轴操作
   * @param record 媒体记录
   */
  const handleAddToTimeline = useCallback(
    async (record: MediaRecord) => {
      await addRecordToCanvas(record);
    },
    [addRecordToCanvas]
  );

  /**
   * 拖拽进入事件
   */
  const handleDragEnter: React.DragEventHandler<HTMLDivElement> = useCallback(
    (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (event.dataTransfer?.items?.length) {
        setIsDragOver(true);
      }
    },
    []
  );

  /**
   * 拖拽悬停事件
   */
  const handleDragOver: React.DragEventHandler<HTMLDivElement> = useCallback(
    (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (!isDragOver && event.dataTransfer?.items?.length) {
        setIsDragOver(true);
      }
    },
    [isDragOver]
  );

  /**
   * 拖拽离开事件
   */
  const handleDragLeave: React.DragEventHandler<HTMLDivElement> = useCallback(
    (event) => {
      event.preventDefault();
      event.stopPropagation();
      setIsDragOver(false);
    },
    []
  );

  /**
   * 拖拽释放事件（文件上传）
   */
  const handleDrop: React.DragEventHandler<HTMLDivElement> = useCallback(
    async (event) => {
      event.preventDefault();
      event.stopPropagation();
      setIsDragOver(false);
      const file = event.dataTransfer?.files?.[0];
      if (!file) return;
      await loadMediaFile(file);
    },
    [loadMediaFile]
  );

  // =============================================================================
  // 渲染
  // =============================================================================

  /** 渲染媒体面板组件 */
  return (
    <div className="media-panel">
      <div className="media-panel__content">
        {/* 顶部搜索/筛选栏 */}
        <div className="media-panel__header">
          <div className="media-panel__search">
            <Search
              size={16}
              className="media-panel__search-icon"
              aria-hidden
            />
            <input
              type="text"
              placeholder="搜索媒体..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  (e.target as HTMLInputElement).blur();
                }
              }}
              className="media-panel__search-input"
            />
          </div>
          <Select.Root
            value={typeFilter}
            onValueChange={(v) =>
              setTypeFilter(v as "all" | "video" | "image" | "audio")
            }
          >
            <Select.Trigger
              className="media-panel__type-trigger"
              aria-label="类型筛选"
            >
              <Select.Value />
              <Select.Icon className="media-panel__type-icon">
                <span aria-hidden>▼</span>
              </Select.Icon>
            </Select.Trigger>
            <Select.Portal>
              <Select.Content
                className="media-panel__type-content"
                position="popper"
                sideOffset={4}
              >
                <Select.Viewport>
                  {TYPE_OPTIONS.map((opt) => (
                    <Select.Item
                      key={opt.value}
                      value={opt.value}
                      textValue={opt.label}
                      className="media-panel__type-item"
                    >
                      <Select.ItemText>{opt.label}</Select.ItemText>
                    </Select.Item>
                  ))}
                </Select.Viewport>
              </Select.Content>
            </Select.Portal>
          </Select.Root>
          <button
            type="button"
            className="media-panel__upload-btn"
            onClick={() => triggerAddMedia()}
            aria-label="上传媒体"
            title="上传媒体"
          >
            <CloudUpload size={16} />
          </button>
        </div>

        {/* 时间标签筛选器 */}
        <div className="media-panel__tags">
          {TIME_TAGS.map((tag) => (
            <button
              key={tag.value}
              type="button"
              className={`media-panel__tag ${
                timeTag === tag.value ? "media-panel__tag--active" : ""
              }`}
              onClick={() => setTimeTag(tag.value)}
            >
              {tag.label}
            </button>
          ))}
        </div>

        {/* 媒体列表/骨架屏/空态等区域 */}
        <div
          className="media-panel__scrollable"
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onScroll={() => {
            if (deleteConfirmId !== null) {
              setDeleteConfirmId(null);
            }
          }}
        >
          {/* 加载异常 */}
          {loadError && (
            <div className="media-panel__error">
              {loadError}
              <button
                type="button"
                className="media-panel__retry"
                onClick={() => void refreshList()}
              >
                重试
              </button>
            </div>
          )}

          {/* 添加到时间轴异常 */}
          {addError && (
            <div className="media-panel__error">
              {addError}
              <button
                type="button"
                className="media-panel__retry"
                onClick={() => setAddError(null)}
              >
                关闭
              </button>
            </div>
          )}

          {/* 初始加载中时显示骨架屏 */}
          {isLoading && !loadError ? (
            <div className="media-panel__grid">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="media-panel__skeleton-item">
                  <div className="media-panel__skeleton-thumbnail" />
                  <div className="media-panel__skeleton-name" />
                </div>
              ))}
            </div>
          ) : (
            <>
              {/* 空状态判断逻辑 */}
              {isInitialLoaded &&
              !loadError &&
              filteredList.length === 0 &&
              pendingUploads.length === 0 ? (
                hasActiveFilters ? (
                  <div className="media-panel__empty-filter">
                    <div className="media-panel__empty-filter-text">
                      当前筛选条件下暂无媒体
                    </div>
                    <div className="media-panel__empty-filter-hint">
                      尝试调整时间范围、类型或搜索关键词
                    </div>
                  </div>
                ) : (
                  <div
                    className={
                      "media-panel__empty" +
                      (isDragOver ? " media-panel__empty--dragover" : "")
                    }
                    onClick={() => {
                      triggerAddMedia();
                    }}
                  >
                    <div className="media-panel__empty-icon">
                      <Plus size={18} />
                    </div>
                    <div className="media-panel__empty-text">
                      媒体库为空，你可以将文件拖拽到此处，
                      <br />
                      或点击此区域从本地添加媒体
                    </div>
                  </div>
                )
              ) : (
                <div className="media-panel__grid">
                  {columns.map((colItems, colIndex) => (
                    <div key={colIndex} className="media-panel__column">
                      {colItems.map((item) =>
                        item.type === "uploading" ? (
                          <div
                            key={item.data.id}
                            className="media-panel__uploading-item"
                            title={item.data.name}
                          >
                            <div className="media-panel__uploading-thumbnail">
                              <Loader2
                                size={24}
                                className="media-panel__uploading-spinner"
                                aria-hidden
                              />
                              <div className="media-panel__uploading-progress-wrap">
                                <div className="media-panel__uploading-progress-bar">
                                  <div
                                    style={{
                                      width:
                                        item.data.progress >= 0
                                          ? `${item.data.progress}%`
                                          : "0%",
                                    }}
                                  />
                                </div>
                                <span className="media-panel__uploading-percent">
                                  {item.data.error
                                    ? ""
                                    : item.data.progress >= 0
                                      ? `${item.data.progress}%`
                                      : "0%"}
                                </span>
                              </div>
                              {item.data.error && (
                                <span className="media-panel__uploading-error">
                                  {item.data.error}
                                </span>
                              )}
                            </div>
                            <div
                              className="media-panel__media-name"
                              title={item.data.name}
                            >
                              {item.data.name}
                            </div>
                          </div>
                        ) : item.data.type === "video" ? (
                          <div
                            key={item.data.id}
                            className="media-panel__video-item"
                            onClick={() => {
                              void addRecordToCanvas(item.data);
                            }}
                            onMouseEnter={() => {
                              setHoveredVideoId(item.data.id);
                              setIsVideoPreviewMuted(true);
                              const el = videoRefs.current[item.data.id];
                              if (el) {
                                el.muted = true;
                                el.currentTime = 0;
                                void el.play();
                              }
                            }}
                            onMouseLeave={() => {
                              const el = videoRefs.current[item.data.id];
                              if (el) {
                                el.pause();
                              }
                              setHoveredVideoId(null);
                            }}
                          >
                            <div className="media-panel__video-thumbnail">
                              {item.data.source === "ai" && (
                                <span
                                  className="media-panel__source-badge"
                                  title="AI生成"
                                >
                                  AI生成
                                </span>
                              )}
                              {item.data.coverUrl ? (
                                <img
                                  src={item.data.coverUrl}
                                  alt={item.data.name}
                                  className="media-panel__video-cover"
                                />
                              ) : (
                                <div className="media-panel__video-placeholder">
                                  <Film
                                    size={32}
                                    className="media-panel__video-placeholder-icon"
                                  />
                                </div>
                              )}
                              <video
                                ref={(el) => {
                                  videoRefs.current[item.data.id] = el;
                                }}
                                src={getDisplayUrl(item.data) || undefined}
                                className={`media-panel__video-preview ${
                                  hoveredVideoId === item.data.id
                                    ? "media-panel__video-preview--visible"
                                    : ""
                                }`}
                                loop
                                muted={isVideoPreviewMuted}
                                playsInline
                                preload="metadata"
                              />
                              <button
                                type="button"
                                className="media-panel__mute-btn"
                                aria-label={
                                  isVideoPreviewMuted ? "开启声音" : "静音"
                                }
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setIsVideoPreviewMuted((prev) => {
                                    const next = !prev;
                                    Object.values(videoRefs.current).forEach(
                                      (el) => {
                                        if (el) {
                                          el.muted = next;
                                        }
                                      }
                                    );
                                    return next;
                                  });
                                }}
                              >
                                {isVideoPreviewMuted ? (
                                  <VolumeX size={16} />
                                ) : (
                                  <Volume2 size={16} />
                                )}
                              </button>
                              <button
                                type="button"
                                className="media-panel__zoom-btn"
                                aria-label="查看详情"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPreviewRecord(item.data);
                                }}
                              >
                                <Maximize2 size={18} />
                              </button>
                              <div className="media-panel__video-duration">
                                {item.data.duration != null
                                  ? formatDuration(item.data.duration)
                                  : "0:00"}
                              </div>
                              <Popover.Root
                                open={deleteConfirmId === item.data.id}
                                onOpenChange={(open) => {
                                  if (open) {
                                    setDeleteConfirmId(item.data.id);
                                  } else if (deleteConfirmId === item.data.id) {
                                    setDeleteConfirmId(null);
                                  }
                                }}
                              >
                                <Popover.Trigger asChild>
                                  <button
                                    type="button"
                                    className="media-panel__delete-btn"
                                    aria-label="删除"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                    }}
                                  >
                                    <Trash2 size={18} />
                                  </button>
                                </Popover.Trigger>
                                <Popover.Portal>
                                  <Popover.Content
                                    className="media-panel__delete-popover"
                                    side="top"
                                    align="end"
                                    sideOffset={6}
                                  >
                                    <div className="media-panel__delete-popover-title">
                                      确认删除该媒体？
                                    </div>
                                    <div className="media-panel__delete-popover-text">
                                      仅从媒体库移除
                                    </div>
                                    <div className="media-panel__delete-popover-actions">
                                      <button
                                        type="button"
                                        className="media-panel__delete-popover-btn media-panel__delete-popover-btn--secondary"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setDeleteConfirmId(null);
                                        }}
                                      >
                                        取消
                                      </button>
                                      <button
                                        type="button"
                                        className="media-panel__delete-popover-btn media-panel__delete-popover-btn--danger"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          void deleteMedia(item.data.id).then(
                                            () => {
                                              setDeleteConfirmId((curr) =>
                                                curr === item.data.id
                                                  ? null
                                                  : curr
                                              );
                                              showToast("已从媒体库移除");
                                              setList((prev) =>
                                                prev.filter(
                                                  (r) => r.id !== item.data.id
                                                )
                                              );
                                              setTotalResults((prev) =>
                                                Math.max(0, prev - 1)
                                              );
                                            }
                                          );
                                        }}
                                      >
                                        删除
                                      </button>
                                    </div>
                                  </Popover.Content>
                                </Popover.Portal>
                              </Popover.Root>
                            </div>
                            <div
                              className="media-panel__media-name"
                              title={item.data.name}
                            >
                              {item.data.name}
                            </div>
                          </div>
                        ) : item.data.type === "audio" ? (
                          <div
                            key={item.data.id}
                            className="media-panel__audio-item"
                            onMouseEnter={() => {
                              void startAudioPreview(item.data);
                            }}
                            onMouseLeave={() => {
                              stopAudioPreview();
                            }}
                            onClick={() => {
                              void addRecordToCanvas(item.data);
                            }}
                          >
                            <div className="media-panel__audio-thumbnail">
                              {item.data.source === "ai" && (
                                <span
                                  className="media-panel__source-badge"
                                  title="AI生成"
                                >
                                  AI生成
                                </span>
                              )}
                              {item.data.coverUrl ? (
                                <img
                                  src={item.data.coverUrl}
                                  alt={item.data.name}
                                  className="media-panel__audio-waveform"
                                />
                              ) : (
                                <Music
                                  size={32}
                                  className="media-panel__audio-icon"
                                />
                              )}
                              <button
                                type="button"
                                className="media-panel__mute-btn"
                                aria-label={
                                  isAudioPreviewMuted ? "开启声音" : "静音"
                                }
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setIsAudioPreviewMuted((prev) => {
                                    const next = !prev;
                                    if (audioPreviewRef.current) {
                                      audioPreviewRef.current.muted = next;
                                    }
                                    return next;
                                  });
                                }}
                              >
                                {isAudioPreviewMuted ? (
                                  <VolumeX size={16} />
                                ) : (
                                  <Volume2 size={16} />
                                )}
                              </button>
                              <button
                                type="button"
                                className="media-panel__zoom-btn"
                                aria-label="查看详情"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPreviewRecord(item.data);
                                }}
                              >
                                <Maximize2 size={18} />
                              </button>
                              <Popover.Root
                                open={deleteConfirmId === item.data.id}
                                onOpenChange={(open) => {
                                  if (open) {
                                    setDeleteConfirmId(item.data.id);
                                  } else if (deleteConfirmId === item.data.id) {
                                    setDeleteConfirmId(null);
                                  }
                                }}
                              >
                                <Popover.Trigger asChild>
                                  <button
                                    type="button"
                                    className="media-panel__delete-btn"
                                    aria-label="删除"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                    }}
                                  >
                                    <Trash2 size={18} />
                                  </button>
                                </Popover.Trigger>
                                <Popover.Portal>
                                  <Popover.Content
                                    className="media-panel__delete-popover"
                                    side="top"
                                    align="end"
                                    sideOffset={6}
                                  >
                                    <div className="media-panel__delete-popover-title">
                                      确认删除该媒体？
                                    </div>
                                    <div className="media-panel__delete-popover-text">
                                      仅从媒体库移除
                                    </div>
                                    <div className="media-panel__delete-popover-actions">
                                      <button
                                        type="button"
                                        className="media-panel__delete-popover-btn media-panel__delete-popover-btn--secondary"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setDeleteConfirmId(null);
                                        }}
                                      >
                                        取消
                                      </button>
                                      <button
                                        type="button"
                                        className="media-panel__delete-popover-btn media-panel__delete-popover-btn--danger"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          void deleteMedia(item.data.id).then(
                                            () => {
                                              setDeleteConfirmId((curr) =>
                                                curr === item.data.id
                                                  ? null
                                                  : curr
                                              );
                                              showToast("已从媒体库移除");
                                              setList((prev) =>
                                                prev.filter(
                                                  (r) => r.id !== item.data.id
                                                )
                                              );
                                              setTotalResults((prev) =>
                                                Math.max(0, prev - 1)
                                              );
                                            }
                                          );
                                        }}
                                      >
                                        删除
                                      </button>
                                    </div>
                                  </Popover.Content>
                                </Popover.Portal>
                              </Popover.Root>
                              {item.data.duration != null && (
                                <div className="media-panel__audio-duration">
                                  {formatDuration(item.data.duration)}
                                </div>
                              )}
                            </div>
                            <div
                              className="media-panel__audio-name"
                              title={item.data.name}
                            >
                              {item.data.name}
                            </div>
                          </div>
                        ) : (
                          <div
                            key={item.data.id}
                            className="media-panel__image-item"
                            onClick={() => {
                              void addRecordToCanvas(item.data);
                            }}
                          >
                            <div className="media-panel__image-thumbnail">
                              {item.data.source === "ai" && (
                                <span
                                  className="media-panel__source-badge"
                                  title="AI生成"
                                >
                                  AI生成
                                </span>
                              )}
                              <img
                                src={getDisplayUrl(item.data) || undefined}
                                alt={item.data.name}
                                className="media-panel__image-thumbnail-image"
                              />
                              <button
                                type="button"
                                className="media-panel__zoom-btn"
                                aria-label="查看详情"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPreviewRecord(item.data);
                                }}
                              >
                                <Maximize2 size={18} />
                              </button>
                              <Popover.Root
                                open={deleteConfirmId === item.data.id}
                                onOpenChange={(open) => {
                                  if (open) {
                                    setDeleteConfirmId(item.data.id);
                                  } else if (deleteConfirmId === item.data.id) {
                                    setDeleteConfirmId(null);
                                  }
                                }}
                              >
                                <Popover.Trigger asChild>
                                  <button
                                    type="button"
                                    className="media-panel__delete-btn"
                                    aria-label="删除"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                    }}
                                  >
                                    <Trash2 size={18} />
                                  </button>
                                </Popover.Trigger>
                                <Popover.Portal>
                                  <Popover.Content
                                    className="media-panel__delete-popover"
                                    side="top"
                                    align="end"
                                    sideOffset={6}
                                  >
                                    <div className="media-panel__delete-popover-title">
                                      确认删除该媒体？
                                    </div>
                                    <div className="media-panel__delete-popover-text">
                                      仅从媒体库移除
                                    </div>
                                    <div className="media-panel__delete-popover-actions">
                                      <button
                                        type="button"
                                        className="media-panel__delete-popover-btn media-panel__delete-popover-btn--secondary"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setDeleteConfirmId(null);
                                        }}
                                      >
                                        取消
                                      </button>
                                      <button
                                        type="button"
                                        className="media-panel__delete-popover-btn media-panel__delete-popover-btn--danger"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          void deleteMedia(item.data.id).then(
                                            () => {
                                              setDeleteConfirmId((curr) =>
                                                curr === item.data.id
                                                  ? null
                                                  : curr
                                              );
                                              showToast("已从媒体库移除");
                                              setList((prev) =>
                                                prev.filter(
                                                  (r) => r.id !== item.data.id
                                                )
                                              );
                                              setTotalResults((prev) =>
                                                Math.max(0, prev - 1)
                                              );
                                            }
                                          );
                                        }}
                                      >
                                        删除
                                      </button>
                                    </div>
                                  </Popover.Content>
                                </Popover.Portal>
                              </Popover.Root>
                            </div>
                            <div
                              className="media-panel__media-name"
                              title={item.data.name}
                            >
                              {item.data.name}
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* 分页加载更多 */}
              {showLoadMore && (
                <div className="media-panel__pagination">
                  <button
                    type="button"
                    className="media-panel__load-more"
                    disabled={isLoadingMore}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    {isLoadingMore ? "加载中…" : "加载更多"}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* 详情弹窗 */}
      <Dialog.Root
        open={previewRecord !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPreviewRecord(null);
            previewVideoRef.current?.pause();
            previewAudioRef.current?.pause();
          }
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="media-panel__dialog-overlay" />
          {previewRecord && (
            <Dialog.Content className="media-panel__dialog-content">
              <button
                type="button"
                className="media-panel__dialog-close"
                aria-label="关闭"
                onClick={() => {
                  setPreviewRecord(null);
                  previewVideoRef.current?.pause();
                  previewAudioRef.current?.pause();
                }}
              >
                ×
              </button>
              <div className="media-panel__dialog-media">
                {previewRecord.type === "video" ? (
                  <video
                    ref={previewVideoRef}
                    src={getDisplayUrl(previewRecord) || undefined}
                    className="media-panel__dialog-video"
                    controls
                    playsInline
                    preload="metadata"
                  />
                ) : previewRecord.type === "audio" ? (
                  <div className="media-panel__dialog-audio-wrap">
                    <audio
                      ref={previewAudioRef}
                      src={getDisplayUrl(previewRecord) || undefined}
                      className="media-panel__dialog-audio"
                      controls
                      preload="metadata"
                      muted={isDialogAudioMuted}
                    />
                    <button
                      type="button"
                      className="media-panel__dialog-mute-btn"
                      aria-label={isDialogAudioMuted ? "开启声音" : "静音"}
                      onClick={() => {
                        setIsDialogAudioMuted((prev) => {
                          const next = !prev;
                          if (previewAudioRef.current) {
                            previewAudioRef.current.muted = next;
                          }
                          return next;
                        });
                      }}
                    >
                      {isDialogAudioMuted ? (
                        <VolumeX size={20} />
                      ) : (
                        <Volume2 size={20} />
                      )}
                    </button>
                  </div>
                ) : (
                  <img
                    src={getDisplayUrl(previewRecord) || undefined}
                    alt={previewRecord.name}
                    className="media-panel__dialog-image"
                  />
                )}
                <div className="media-panel__dialog-info">
                  <div className="media-panel__dialog-meta">
                    <span>名称: {previewRecord.name}</span>
                    <span>来源: {getSourceLabel(previewRecord.source)}</span>
                    <div>
                      <span>
                        添加时间: {formatAddedAt(previewRecord.addedAt)}
                      </span>
                    </div>
                  </div>
                  <div className="media-panel__dialog-actions">
                    <button
                      type="button"
                      className="media-panel__dialog-btn media-panel__dialog-btn--primary"
                      onClick={async () => {
                        const rec = previewRecord;
                        if (!rec) {
                          return;
                        }
                        setPreviewRecord(null);
                        previewVideoRef.current?.pause();
                        await handleAddToTimeline(rec);
                      }}
                    >
                      <Plus size={16} />
                      添加到时间轴
                    </button>
                  </div>
                </div>
              </div>
            </Dialog.Content>
          )}
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
