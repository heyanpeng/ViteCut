import { useState, useEffect, useCallback, useRef } from "react";
import { Search, Maximize2, Upload, Plus, Volume2, VolumeX } from "lucide-react";
import { Dialog } from "radix-ui";
import { useProjectStore } from "@/stores/projectStore";
import { add as addToMediaStorage } from "@/utils/mediaStorage";
import "./VideoPanel.css";

const PEXELS_API_BASE = "https://api.pexels.com/videos";
const PER_PAGE = 15;

type PexelsVideoFile = {
  id: number;
  quality: string | null;
  file_type: string;
  width: number;
  height: number;
  fps: number;
  link: string;
  size: number;
};

type PexelsVideoPicture = {
  id: number;
  nr: number;
  picture: string;
};

type PexelsVideoUser = {
  id: number;
  name: string;
  url: string;
};

type PexelsVideo = {
  id: number;
  width: number;
  height: number;
  duration: number;
  image: string;
  user?: PexelsVideoUser;
  video_files: PexelsVideoFile[];
  video_pictures: PexelsVideoPicture[];
};

type PexelsSearchResponse = {
  page: number;
  per_page: number;
  videos: PexelsVideo[];
  total_results: number;
  next_page?: string;
};

type VideoItem = {
  id: string;
  title: string;
  duration: string;
  durationSeconds: number;
  thumbnailUrl: string;
  videoUrl: string;
  aspectRatio: "landscape" | "portrait";
  width?: number;
  height?: number;
  photographer?: string;
};

type DisplayVideoItem = VideoItem & { column: 0 | 1 };

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function pickVideoUrl(files: PexelsVideoFile[]): string {
  const prefer =
    files.find((f) => f.width === 1920 && f.height === 1080) ??
    files.find((f) => f.width === 1280 && f.height === 720) ??
    files.find((f) => f.width >= 1280) ??
    files[0];
  return prefer?.link ?? "";
}

function mapPexelsToItem(v: PexelsVideo): VideoItem {
  const aspectRatio: "landscape" | "portrait" =
    v.width >= v.height ? "landscape" : "portrait";
  return {
    id: String(v.id),
    title: `Video ${v.id}`,
    duration: formatDuration(v.duration),
    durationSeconds: v.duration,
    thumbnailUrl: v.image ?? v.video_pictures?.[0]?.picture ?? "",
    videoUrl: pickVideoUrl(v.video_files),
    aspectRatio,
    width: v.width,
    height: v.height,
    photographer: v.user?.name,
  };
}

async function fetchPexelsVideos(
  query: string,
  page: number,
): Promise<PexelsSearchResponse> {
  const params = new URLSearchParams({
    query: query || "nature",
    per_page: String(PER_PAGE),
    page: String(page),
  });
  const url = `${PEXELS_API_BASE}/search?${params}`;
  const headers: HeadersInit = {};
  const apiKey = import.meta.env.VITE_PEXELS_API_KEY;
  if (apiKey) {
    headers["Authorization"] = apiKey;
  }
  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`Pexels API error: ${res.status}`);
  }
  return res.json();
}

const TAGS: { label: string; query: string }[] = [
  { label: "自然", query: "nature" },
  { label: "城市", query: "city" },
  { label: "旅行", query: "travel" },
  { label: "海洋", query: "ocean" },
  { label: "山脉", query: "mountain" },
  { label: "天空", query: "sky" },
  { label: "日落", query: "sunset" },
  { label: "夜景", query: "night" },
  { label: "水", query: "water" },
  { label: "森林", query: "forest" },
  { label: "花朵", query: "flowers" },
  { label: "背景", query: "background" },
  { label: "人物", query: "people" },
  { label: "动物", query: "animals" },
  { label: "食物", query: "food" },
  { label: "咖啡", query: "coffee" },
  { label: "商业", query: "business" },
  { label: "办公", query: "office" },
  { label: "科技", query: "technology" },
  { label: "运动", query: "sports" },
  { label: "健身", query: "fitness" },
  { label: "音乐", query: "music" },
  { label: "抽象", query: "abstract" },
];

export function VideoPanel() {
  const [videos, setVideos] = useState<DisplayVideoItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalResults, setTotalResults] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [queryForApi, setQueryForApi] = useState("nature");
  const [hoveredVideoId, setHoveredVideoId] = useState<string | null>(null);
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  const [isPreviewMuted, setIsPreviewMuted] = useState(true);

  const loadPage = useCallback(
    async (q: string, pageNum: number, append: boolean) => {
      const setLoading = append ? setIsLoadingMore : setIsLoading;
      setLoading(true);
      setError(null);
      try {
        const data = await fetchPexelsVideos(q, pageNum);
        const items = data.videos.map(mapPexelsToItem);

        // 瀑布流两列：append 时保持已有 item 的列不变，只给新视频分配列，避免位置跳动
        setVideos((prev) => {
          const prevList = append ? prev : [];
          const colHeights: [number, number] = [0, 0];

          if (append) {
            for (const v of prevList) {
              const ratio = v.width && v.height ? v.height / v.width : 9 / 16;
              colHeights[v.column] += ratio;
            }
          }

          const next: DisplayVideoItem[] = [...prevList];
          for (const v of items) {
            const ratio = v.width && v.height ? v.height / v.width : 9 / 16;
            const col = colHeights[0] <= colHeights[1] ? 0 : 1;
            colHeights[col] += ratio;
            next.push({ ...v, column: col });
          }

          return next;
        });
        setTotalResults(data.total_results);
      } catch (e) {
        setError(e instanceof Error ? e.message : "加载失败");
        if (!append) {
          setVideos([]);
        }
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // 初始加载与搜索/分页：query 或 page 变化时请求
  useEffect(() => {
    loadPage(queryForApi, page, page > 1);
  }, [queryForApi, page, loadPage]);

  const handleSearchSubmit = () => {
    setQueryForApi(searchQuery.trim() || "nature");
    setPage(1);
  };

  const handleTagClick = (tag: { label: string; query: string }) => {
    setSearchQuery(tag.query);
    setQueryForApi(tag.query);
    setPage(1);
  };

  const hasMore = videos.length < totalResults;
  const showLoadMore = !isLoading && !error && hasMore && videos.length > 0;

  const [previewVideo, setPreviewVideo] = useState<VideoItem | null>(null);
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const addMediaPlaceholder = useProjectStore((s) => s.addMediaPlaceholder);
  const resolveMediaPlaceholder = useProjectStore(
    (s) => s.resolveMediaPlaceholder,
  );

  const addVideoToCanvas = useCallback(
    async (video: VideoItem) => {
      const ids = addMediaPlaceholder({
        name: `pexels-${video.id}.mp4`,
        kind: "video",
        sourceUrl: video.videoUrl,
      });
      try {
        const res = await fetch(video.videoUrl);
        const blob = await res.blob();
        const file = new File([blob], `pexels-${video.id}.mp4`, {
          type: blob.type || "video/mp4",
        });
        await resolveMediaPlaceholder(ids, file);
        setPreviewVideo(null);
      } catch (err) {
        await resolveMediaPlaceholder(ids, null);
        console.error("添加视频到画板失败:", err);
      }
    },
    [addMediaPlaceholder, resolveMediaPlaceholder],
  );

  const handleAddToTimeline = useCallback(
    async (video: VideoItem) => {
      await addVideoToCanvas(video);
    },
    [addVideoToCanvas],
  );

  const handleAddToLibrary = useCallback(async (video: VideoItem) => {
    await addToMediaStorage({
      id: `pexels-video-${video.id}`,
      name: `pexels-${video.id}.mp4`,
      type: "video",
      addedAt: Date.now(),
      url: video.videoUrl,
      duration: video.durationSeconds,
    });
    setPreviewVideo(null);
  }, []);

  return (
    <div className="video-panel">
      <div className="video-panel__content">
        <div className="video-panel__header">
          <div className="video-panel__search">
            <Search size={16} className="video-panel__search-icon" />
            <input
              type="text"
              placeholder="搜索视频..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSearchSubmit();
                }
              }}
              className="video-panel__search-input"
            />
          </div>
        </div>

        <div className="video-panel__tags">
          {TAGS.map((tag) => (
            <button
              key={tag.query}
              className="video-panel__tag"
              onClick={() => handleTagClick(tag)}
            >
              {tag.label}
            </button>
          ))}
        </div>

        <div className="video-panel__scrollable">
          {error && (
            <div className="video-panel__error">
              {error}
              <button
                type="button"
                className="video-panel__retry"
                onClick={() => loadPage(queryForApi, 1, false)}
              >
                重试
              </button>
            </div>
          )}

          {isLoading ? (
            <div className="video-panel__grid">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="video-panel__skeleton-item">
                  <div className="video-panel__skeleton-thumbnail"></div>
                </div>
              ))}
            </div>
          ) : (
            <div className="video-panel__grid">
              {[0, 1].map((col) => (
                <div key={col} className="video-panel__column">
                  {videos
                    .filter((video) => video.column === col)
                    .map((video) => (
                      <div
                        key={video.id}
                        className="video-panel__video-item"
                        onClick={() => {
                          void addVideoToCanvas(video);
                        }}
                        onMouseEnter={() => {
                          setHoveredVideoId(video.id);
                          // hover 时无论之前状态如何，都从静音开始预览
                          setIsPreviewMuted(true);
                          const el = videoRefs.current[video.id];
                          if (el) {
                            el.muted = true;
                            el.currentTime = 0;
                            void el.play();
                          }
                        }}
                        onMouseLeave={() => {
                          const el = videoRefs.current[video.id];
                          if (el) {
                            el.pause();
                          }
                          setHoveredVideoId(null);
                        }}
                      >
                        <div className="video-panel__video-thumbnail">
                          <img
                            src={video.thumbnailUrl}
                            alt={video.title}
                            className="video-panel__video-thumbnail-image"
                          />
                          <video
                            ref={(el) => {
                              videoRefs.current[video.id] = el;
                            }}
                            src={video.videoUrl}
                            className={`video-panel__video-preview ${
                              hoveredVideoId === video.id
                                ? "video-panel__video-preview--visible"
                                : ""
                            }`}
                            loop
                            muted={isPreviewMuted}
                            playsInline
                            preload="metadata"
                          />
                          <button
                            type="button"
                            className="video-panel__mute-btn"
                            aria-label={isPreviewMuted ? "开启声音" : "静音"}
                            onClick={(e) => {
                              e.stopPropagation();
                              setIsPreviewMuted((prev) => {
                                const next = !prev;
                                Object.values(videoRefs.current).forEach((el) => {
                                  if (el) {
                                    el.muted = next;
                                  }
                                });
                                return next;
                              });
                            }}
                          >
                            {isPreviewMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                          </button>
                          <button
                            type="button"
                            className="video-panel__zoom-btn"
                            aria-label="查看详情"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPreviewVideo(video);
                            }}
                          >
                            <Maximize2 size={18} />
                          </button>
                          <div className="video-panel__video-duration">
                            {video.duration}
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              ))}
            </div>
          )}

          {showLoadMore && (
            <div className="video-panel__pagination">
              <button
                type="button"
                className="video-panel__load-more"
                disabled={isLoadingMore}
                onClick={() => setPage((p) => p + 1)}
              >
                {isLoadingMore ? "加载中…" : "加载更多"}
              </button>
            </div>
          )}
        </div>
      </div>

      <Dialog.Root
        open={previewVideo !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPreviewVideo(null);
            previewVideoRef.current?.pause();
          }
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="video-panel__dialog-overlay" />
          {previewVideo && (
            <Dialog.Content className="video-panel__dialog-content">
              <button
                type="button"
                className="video-panel__dialog-close"
                aria-label="关闭"
                onClick={() => setPreviewVideo(null)}
              >
                ×
              </button>
              <div className="video-panel__dialog-media">
                <video
                  ref={previewVideoRef}
                  src={previewVideo.videoUrl}
                  className="video-panel__dialog-video"
                  controls
                  playsInline
                  preload="metadata"
                />
                <div className="video-panel__dialog-info">
                  <div className="video-panel__dialog-meta">
                    {previewVideo.width != null && previewVideo.height != null && (
                      <span>
                        {previewVideo.width} × {previewVideo.height}
                      </span>
                    )}
                    <span>时长 {previewVideo.duration}</span>
                    {previewVideo.photographer && (
                      <span>作者 {previewVideo.photographer}</span>
                    )}
                  </div>
                  <div className="video-panel__dialog-actions">
                    <button
                      type="button"
                      className="video-panel__dialog-btn video-panel__dialog-btn--secondary"
                      onClick={() => handleAddToLibrary(previewVideo)}
                    >
                      <Upload size={16} />
                      添加到媒体库
                    </button>
                    <button
                      type="button"
                      className="video-panel__dialog-btn video-panel__dialog-btn--primary"
                      onClick={async () => {
                        const video = previewVideo;
                        if (!video) return;
                        setPreviewVideo(null);
                        previewVideoRef.current?.pause();
                        await handleAddToTimeline(video);
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
