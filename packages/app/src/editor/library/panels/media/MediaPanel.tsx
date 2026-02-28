import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import {
  Search,
  Maximize2,
  Plus,
  Trash2,
  Music,
  Volume2,
  VolumeX,
  Loader2,
} from "lucide-react";
import { Dialog, Select, Popover } from "radix-ui";
import { useProjectStore } from "@/stores/projectStore";
import {
  fetchMediaList,
  deleteMedia,
  updateMedia,
  type MediaRecord,
} from "@/api/mediaApi";
import { getRangeForTag, type TimeTag } from "@/utils/mediaStorage";
import {
  useAddMediaContext,
  type PendingUpload,
} from "@/contexts/AddMediaContext";
import "./MediaPanel.css";

const TYPE_OPTIONS: {
  value: "all" | "video" | "image" | "audio";
  label: string;
}[] = [
  { value: "all", label: "全部" },
  { value: "video", label: "仅视频" },
  { value: "image", label: "仅图片" },
  { value: "audio", label: "仅音频" },
];

const TIME_TAGS: { value: TimeTag; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "today", label: "今天" },
  { value: "yesterday", label: "昨天" },
  { value: "thisWeek", label: "本周" },
  { value: "thisMonth", label: "本月" },
];

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatAddedAt(ts: number): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day} ${hh}:${mm}`;
}

export function MediaPanel() {
  const [list, setList] = useState<MediaRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<
    "all" | "video" | "image" | "audio"
  >("all");
  const [timeTag, setTimeTag] = useState<TimeTag>("all");
  const [previewRecord, setPreviewRecord] = useState<MediaRecord | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const [hoveredVideoId, setHoveredVideoId] = useState<string | null>(null);
  const [isInitialLoaded, setIsInitialLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const [isVideoPreviewMuted, setIsVideoPreviewMuted] = useState(true);
  const [isAudioPreviewMuted, setIsAudioPreviewMuted] = useState(true);
  const [isDialogAudioMuted, setIsDialogAudioMuted] = useState(false);

  const {
    trigger: triggerAddMedia,
    loadFile: loadMediaFile,
    pendingUploads,
  } = useAddMediaContext();

  const addMediaPlaceholder = useProjectStore((s) => s.addMediaPlaceholder);
  const resolveMediaPlaceholder = useProjectStore(
    (s) => s.resolveMediaPlaceholder
  );
  const refreshInFlightRef = useRef(false);

  const refreshList = useCallback(async () => {
    if (refreshInFlightRef.current) return;
    refreshInFlightRef.current = true;
    setLoadError(null);
    try {
      const range = getRangeForTag(timeTag);
      const { items } = await fetchMediaList({
        type:
          typeFilter === "all"
            ? undefined
            : (typeFilter as "video" | "image" | "audio"),
        search: searchQuery.trim() || undefined,
        limit: 200,
        addedAtSince: range?.[0],
        addedAtUntil: range?.[1],
      });
      setList(items);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setIsInitialLoaded(true);
      refreshInFlightRef.current = false;
    }
  }, [timeTag, searchQuery, typeFilter]);

  /** 后端返回的记录只有 url，直接使用 */
  const getDisplayUrl = useCallback((record: MediaRecord) => record.url ?? "", []);

  const stopAudioPreview = useCallback(() => {
    if (audioPreviewRef.current) {
      audioPreviewRef.current.pause();
      audioPreviewRef.current.currentTime = 0;
    }
  }, []);

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

  useEffect(() => {
    return () => {
      if (audioPreviewRef.current) {
        audioPreviewRef.current.pause();
        audioPreviewRef.current.src = "";
      }
    };
  }, []);

  useEffect(() => {
    // 若因上传切换过来导致首次挂载，pendingUploads 非空，跳过初始加载，由 vitecut-media-refresh 触发
    // 不把 pendingUploads.length 放入 deps，避免上传完成后 effect 再跑一遍导致二次请求
    if (pendingUploads.length > 0) return;
    void refreshList();
  }, [refreshList]);

  useEffect(() => {
    const handler = () => void refreshList();
    window.addEventListener("vitecut-media-refresh", handler);
    return () => window.removeEventListener("vitecut-media-refresh", handler);
  }, [refreshList]);

  /** 接口已按筛选条件返回，按添加时间倒序 */
  const filteredList = useMemo(
    () => [...list].sort((a, b) => b.addedAt - a.addedAt),
    [list]
  );

  type ColumnItem =
    | { type: "uploading"; data: PendingUpload }
    | { type: "media"; data: MediaRecord };

  /** 是否有筛选条件（时间/类型/搜索），用于区分「库为空」与「筛选无结果」 */
  const hasActiveFilters = useMemo(
    () =>
      timeTag !== "all" ||
      typeFilter !== "all" ||
      searchQuery.trim() !== "",
    [timeTag, typeFilter, searchQuery]
  );

  /** 两列：上传项先交替填入，再填入媒体项 */
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

  const handleAddToTimeline = useCallback(
    async (record: MediaRecord) => {
      await addRecordToCanvas(record);
    },
    [addRecordToCanvas]
  );

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

  const handleDragLeave: React.DragEventHandler<HTMLDivElement> = useCallback(
    (event) => {
      event.preventDefault();
      event.stopPropagation();
      setIsDragOver(false);
    },
    []
  );

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

  return (
    <div className="media-panel">
      <div className="media-panel__content">
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
        </div>

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
                                  width: item.data.progress >= 0 ? `${item.data.progress}%` : "0%",
                                }}
                              />
                            </div>
                            <span className="media-panel__uploading-percent">
                              {item.data.error ? "" : item.data.progress >= 0 ? `${item.data.progress}%` : "0%"}
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
                          // hover 时无论之前状态如何，都从静音开始预览
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
                            onLoadedMetadata={(e) => {
                              if (
                                item.data.duration != null ||
                                Number.isNaN(
                                  (e.target as HTMLVideoElement).duration
                                )
                              ) {
                                return;
                              }
                              const d = (e.target as HTMLVideoElement).duration;
                              if (d >= 0) {
                                void updateMedia(item.data.id, { duration: d });
                                setList((prev) =>
                                  prev.map((r) =>
                                    r.id === item.data.id
                                      ? { ...r, duration: d }
                                      : r
                                  )
                                );
                              }
                            }}
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
                                      void deleteMedia(item.data.id).then(() => {
                                        setDeleteConfirmId((curr) =>
                                          curr === item.data.id ? null : curr
                                        );
                                        refreshList();
                                      });
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
                                      void deleteMedia(item.data.id).then(() => {
                                        setDeleteConfirmId((curr) =>
                                          curr === item.data.id ? null : curr
                                        );
                                        refreshList();
                                      });
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
                                      void deleteMedia(item.data.id).then(() => {
                                        setDeleteConfirmId((curr) =>
                                          curr === item.data.id ? null : curr
                                        );
                                        refreshList();
                                      });
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
        </div>
      </div>

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
