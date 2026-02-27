import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import {
  Search,
  Maximize2,
  Plus,
  Trash2,
  Music,
  Volume2,
  VolumeX,
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
import { useAddMedia } from "@/hooks/useAddMedia";
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
    fileInputRef,
    fileInputProps,
  } = useAddMedia();

  const addMediaPlaceholder = useProjectStore((s) => s.addMediaPlaceholder);
  const resolveMediaPlaceholder = useProjectStore(
    (s) => s.resolveMediaPlaceholder
  );

  const refreshList = useCallback(async () => {
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

  // 媒体库内容区也使用两列布局，避免不同高度的缩略图出现空洞
  const columns = useMemo(() => {
    const cols: MediaRecord[][] = [[], []];
    filteredList.forEach((record, index) => {
      const colIndex = index % 2;
      cols[colIndex].push(record);
    });
    return cols;
  }, [filteredList]);

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

          {isInitialLoaded && !loadError && filteredList.length === 0 ? (
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
          ) : (
            <div className="media-panel__grid">
              {columns.map((colRecords, colIndex) => (
                <div key={colIndex} className="media-panel__column">
                  {colRecords.map((record) =>
                    record.type === "video" ? (
                      <div
                        key={record.id}
                        className="media-panel__video-item"
                        onClick={() => {
                          void addRecordToCanvas(record);
                        }}
                        onMouseEnter={() => {
                          setHoveredVideoId(record.id);
                          // hover 时无论之前状态如何，都从静音开始预览
                          setIsVideoPreviewMuted(true);
                          const el = videoRefs.current[record.id];
                          if (el) {
                            el.muted = true;
                            el.currentTime = 0;
                            void el.play();
                          }
                        }}
                        onMouseLeave={() => {
                          const el = videoRefs.current[record.id];
                          if (el) {
                            el.pause();
                          }
                          setHoveredVideoId(null);
                        }}
                      >
                        <div className="media-panel__video-thumbnail">
                          <video
                            ref={(el) => {
                              videoRefs.current[record.id] = el;
                            }}
                            src={getDisplayUrl(record) || undefined}
                            className={`media-panel__video-preview ${
                              hoveredVideoId === record.id
                                ? "media-panel__video-preview--visible"
                                : ""
                            }`}
                            loop
                            muted={isVideoPreviewMuted}
                            playsInline
                            preload="metadata"
                            onLoadedMetadata={(e) => {
                              if (
                                record.duration != null ||
                                Number.isNaN(
                                  (e.target as HTMLVideoElement).duration
                                )
                              ) {
                                return;
                              }
                              const d = (e.target as HTMLVideoElement).duration;
                              if (d >= 0) {
                                void updateMedia(record.id, { duration: d }).then(
                                  () => refreshList()
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
                              setPreviewRecord(record);
                            }}
                          >
                            <Maximize2 size={18} />
                          </button>
                          <div className="media-panel__video-duration">
                            {record.duration != null
                              ? formatDuration(record.duration)
                              : "0:00"}
                          </div>
                          <Popover.Root
                            open={deleteConfirmId === record.id}
                            onOpenChange={(open) => {
                              if (open) {
                                setDeleteConfirmId(record.id);
                              } else if (deleteConfirmId === record.id) {
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
                                      void deleteMedia(record.id).then(() => {
                                        setDeleteConfirmId((curr) =>
                                          curr === record.id ? null : curr
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
                          title={record.name}
                        >
                          {record.name}
                        </div>
                      </div>
                    ) : record.type === "audio" ? (
                      <div
                        key={record.id}
                        className="media-panel__audio-item"
                        onMouseEnter={() => {
                          void startAudioPreview(record);
                        }}
                        onMouseLeave={() => {
                          stopAudioPreview();
                        }}
                        onClick={() => {
                          void addRecordToCanvas(record);
                        }}
                      >
                        <div className="media-panel__audio-thumbnail">
                          {record.coverUrl ? (
                            <img
                              src={record.coverUrl}
                              alt={record.name}
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
                              setPreviewRecord(record);
                            }}
                          >
                            <Maximize2 size={18} />
                          </button>
                          <Popover.Root
                            open={deleteConfirmId === record.id}
                            onOpenChange={(open) => {
                              if (open) {
                                setDeleteConfirmId(record.id);
                              } else if (deleteConfirmId === record.id) {
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
                                      void deleteMedia(record.id).then(() => {
                                        setDeleteConfirmId((curr) =>
                                          curr === record.id ? null : curr
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
                          {record.duration != null && (
                            <div className="media-panel__audio-duration">
                              {formatDuration(record.duration)}
                            </div>
                          )}
                        </div>
                        <div
                          className="media-panel__audio-name"
                          title={record.name}
                        >
                          {record.name}
                        </div>
                      </div>
                    ) : (
                      <div
                        key={record.id}
                        className="media-panel__image-item"
                        onClick={() => {
                          void addRecordToCanvas(record);
                        }}
                      >
                        <div className="media-panel__image-thumbnail">
                          <img
                            src={getDisplayUrl(record) || undefined}
                            alt={record.name}
                            className="media-panel__image-thumbnail-image"
                          />
                          <button
                            type="button"
                            className="media-panel__zoom-btn"
                            aria-label="查看详情"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPreviewRecord(record);
                            }}
                          >
                            <Maximize2 size={18} />
                          </button>
                          <Popover.Root
                            open={deleteConfirmId === record.id}
                            onOpenChange={(open) => {
                              if (open) {
                                setDeleteConfirmId(record.id);
                              } else if (deleteConfirmId === record.id) {
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
                                      void deleteMedia(record.id).then(() => {
                                        setDeleteConfirmId((curr) =>
                                          curr === record.id ? null : curr
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
                          title={record.name}
                        >
                          {record.name}
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

      <input ref={fileInputRef} {...fileInputProps} />

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
