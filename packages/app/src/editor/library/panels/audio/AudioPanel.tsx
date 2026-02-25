import { useState, useEffect, useRef, useCallback } from "react";
import { Search, Music, Play, Square } from "lucide-react";
import { useProjectStore } from "@/stores";
import { add as addToMediaStorage } from "@/utils/mediaStorage";
import "./AudioPanel.css";

type AudioTrack = {
  id: string;
  title: string;
  artist: string;
  duration: string;
  durationSeconds: number;
  audioUrl: string;
  coverUrl?: string;
};

// Freesound API 配置
const FREESOUND_API_BASE = "https://freesound.org/apiv2";
const PER_PAGE = 15;

type FreesoundPreviews = {
  "preview-hq-mp3"?: string;
  "preview-lq-mp3"?: string;
  "preview-hq-ogg"?: string;
  "preview-lq-ogg"?: string;
};

type FreesoundImages = {
  waveform_m?: string;
  spectral_m?: string;
};

type FreesoundSound = {
  id: number;
  name: string;
  username: string;
  duration: number;
  previews: FreesoundPreviews;
  images?: FreesoundImages;
};

type FreesoundSearchResponse = {
  count: number;
  next: string | null;
  previous: string | null;
  results: FreesoundSound[];
};

const TAGS: { label: string; query: string }[] = [
  { label: "背景音乐", query: "background music" },
  { label: "放松", query: "lofi chill" },
  { label: "欢快", query: "upbeat" },
  { label: "快乐", query: "happy" },
  { label: "节拍", query: "beat" },
  { label: "Vlog音乐", query: "vlog music" },
  { label: "激励", query: "motivation" },
  { label: "搞笑", query: "funny" },
  { label: "企业", query: "corporate" },
  { label: "器乐", query: "instrumental" },
];

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function mapFreesoundToTrack(s: FreesoundSound): AudioTrack | null {
  const audioUrl =
    s.previews["preview-hq-mp3"] ??
    s.previews["preview-lq-mp3"] ??
    s.previews["preview-hq-ogg"] ??
    s.previews["preview-lq-ogg"];

  if (!audioUrl) {
    return null;
  }

  return {
    id: String(s.id),
    title: s.name || `Sound ${s.id}`,
    artist: s.username,
    duration: formatDuration(s.duration),
    durationSeconds: s.duration,
    audioUrl,
    coverUrl: s.images?.waveform_m ?? s.images?.spectral_m,
  };
}

function makeAudioFileNameFromTitle(title: string, fallbackId: string): string {
  const base =
    title
      .trim()
      // 替换非法文件名字符
      .replace(/[\\/:*?"<>|]+/g, " ")
      .replace(/\s+/g, " ")
      .slice(0, 60) || `audio-${fallbackId}`;
  return `${base}.mp3`;
}

async function fetchFreesoundTracks(
  query: string,
  page: number,
): Promise<FreesoundSearchResponse> {
  const token = import.meta.env.VITE_FREESOUND_API_KEY;
  if (!token) {
    throw new Error("缺少 Freesound API Key（VITE_FREESOUND_API_KEY）");
  }

  const params = new URLSearchParams({
    // 默认用更偏 BGM 的关键词，避免大量杂项占据前排
    query: query || "background music",
    page: String(page),
    page_size: String(PER_PAGE),
    fields: "id,name,username,duration,previews,images",
    // 默认过滤掉极短音频，保留更适合作为背景音乐的素材
    // Freesound 语法：duration:[最小秒数 TO *]
    filter: "duration:[10 TO *]",
    // 按下载量排序，优先展示更常用的音频
    sort: "downloads_desc",
    // 同一个 pack 只保留一个结果，减少同类“zzzbeats miscellaneous music”刷屏
    group_by_pack: "1",
  });

  const res = await fetch(`${FREESOUND_API_BASE}/search/?${params}`, {
    headers: {
      Authorization: `Token ${token}`,
    },
  });

  if (!res.ok) {
    throw new Error(`Freesound API error: ${res.status}`);
  }

  return res.json();
}

export function AudioPanel({ isActive }: { isActive: boolean }) {
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tracks, setTracks] = useState<AudioTrack[]>([]);
  const [page, setPage] = useState(1);
  const [totalResults, setTotalResults] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [queryForApi, setQueryForApi] = useState("music");
  const addMediaPlaceholder = useProjectStore((s) => s.addMediaPlaceholder);
  const resolveMediaPlaceholder = useProjectStore(
    (s) => s.resolveMediaPlaceholder,
  );
  const [loadingTrackId, setLoadingTrackId] = useState<string | null>(null);
  const [hoveredTrackId, setHoveredTrackId] = useState<string | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const [previewTrackId, setPreviewTrackId] = useState<string | null>(null);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [previewCurrentTime, setPreviewCurrentTime] = useState(0);

  const buildQueryForApi = useCallback((raw: string) => {
    const trimmed = raw.trim();
    if (trimmed) return trimmed;
    return "music";
  }, []);

  // 停止当前试听（用于重新查询等场景）
  const stopPreview = useCallback(() => {
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current.currentTime = 0;
    }
    setIsPreviewPlaying(false);
    setPreviewTrackId(null);
    setPreviewCurrentTime(0);
  }, []);

  const loadPage = useCallback(
    async (q: string, pageNum: number, append: boolean) => {
      const setLoading = append ? setIsLoadingMore : setIsLoading;
      setLoading(true);
      setError(null);
      try {
        // 新查询（非 append）时，停止当前试听播放
        if (!append) {
          stopPreview();
        }
        const data = await fetchFreesoundTracks(q, pageNum);
        const items = data.results
          .map(mapFreesoundToTrack)
          .filter((t): t is AudioTrack => t !== null);

        if (append) {
          setTracks((prev) => [...prev, ...items]);
        } else {
          setTracks(items);
        }

        setTotalResults(data.count);
      } catch (e) {
        setError(e instanceof Error ? e.message : "音频加载失败");
        if (!append) {
          setTracks([]);
        }
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // 初始加载与搜索/分页
  useEffect(() => {
    loadPage(queryForApi, page, page > 1);
  }, [queryForApi, page, loadPage]);

  // tab 切换离开音频面板时，停止当前试听
  useEffect(() => {
    if (!isActive) {
      stopPreview();
    }
  }, [isActive, stopPreview]);

  const handleSearchSubmit = () => {
    setQueryForApi(buildQueryForApi(searchQuery));
    setPage(1);
  };

  const handleTagClick = (tag: { label: string; query: string }) => {
    setSearchQuery(tag.query);
    setQueryForApi(buildQueryForApi(tag.query));
    setPage(1);
  };

  // 试听：点击播放按钮只播放预览，不添加到时间轴
  const handlePreviewClick = useCallback(
    async (event: React.MouseEvent, track: AudioTrack) => {
      event.stopPropagation();
      if (!track.audioUrl) return;

      if (!previewAudioRef.current) {
        previewAudioRef.current = new Audio();
        previewAudioRef.current.addEventListener("ended", () => {
          setIsPreviewPlaying(false);
          setPreviewTrackId(null);
          setPreviewCurrentTime(0);
        });
        previewAudioRef.current.addEventListener("timeupdate", () => {
          if (previewAudioRef.current) {
            setPreviewCurrentTime(previewAudioRef.current.currentTime);
          }
        });
      }

      const audio = previewAudioRef.current;

      // 再次点击同一条且正在播放时，暂停
      if (previewTrackId === track.id && isPreviewPlaying) {
        audio.pause();
        stopPreview();
        return;
      }

      setPreviewTrackId(track.id);
      audio.src = track.audioUrl;
      audio.currentTime = 0;
      setPreviewCurrentTime(0);
      try {
        await audio.play();
        setIsPreviewPlaying(true);
      } catch (err) {
        console.error("预览播放失败:", err);
        setIsPreviewPlaying(false);
      }
    },
    [isPreviewPlaying, previewTrackId, stopPreview],
  );

  // 卸载时停止预览播放
  useEffect(() => {
    return () => {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        previewAudioRef.current = null;
      }
    };
  }, []);

  const addTrackToProject = useCallback(
    async (track: AudioTrack) => {
      if (!track.audioUrl) return;
      const fileName = makeAudioFileNameFromTitle(track.title, track.id);
      const ids = addMediaPlaceholder({
        name: fileName,
        kind: "audio",
        sourceUrl: track.audioUrl,
      });
      setLoadingTrackId(track.id);
      try {
        const res = await fetch(track.audioUrl);
        const blob = await res.blob();
        const file = new File([blob], fileName, {
          type: blob.type || "audio/mpeg",
        });
        await resolveMediaPlaceholder(ids, file);
        await addToMediaStorage({
          id: `freesound-${track.id}`,
          name: fileName,
          type: "audio",
          addedAt: Date.now(),
          url: track.audioUrl,
          coverUrl: track.coverUrl,
          duration: track.durationSeconds,
        });
      } catch (err) {
        await resolveMediaPlaceholder(ids, null);
        console.error("音频加载失败:", err);
      } finally {
        setLoadingTrackId(null);
      }
    },
    [addMediaPlaceholder, resolveMediaPlaceholder],
  );

  // 点击进度条控制试听播放进度
  const handlePreviewSeek = useCallback(
    (event: React.MouseEvent<HTMLDivElement>, track: AudioTrack) => {
      event.stopPropagation();
      if (!previewAudioRef.current) return;
      if (previewTrackId !== track.id) return;
      const rect = event.currentTarget.getBoundingClientRect();
      if (rect.width <= 0) return;
      const ratio = Math.min(
        1,
        Math.max(0, (event.clientX - rect.left) / rect.width),
      );
      const targetTime = ratio * track.durationSeconds;
      previewAudioRef.current.currentTime = targetTime;
      setPreviewCurrentTime(targetTime);
    },
    [previewTrackId],
  );

  const hasMore = tracks.length < totalResults;
  const showLoadMore = !isLoading && !error && hasMore && tracks.length > 0;

  return (
    <div className="audio-panel">
      <div className="audio-panel__content">
        {/* 顶部功能区 */}
        <div className="audio-panel__header">
          <div className="audio-panel__search">
            <Search size={16} className="audio-panel__search-icon" />
            <input
              type="text"
              placeholder="搜索音乐..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSearchSubmit();
                }
              }}
              className="audio-panel__search-input"
            />
          </div>
        </div>

        {/* 标签筛选区（与视频面板结构保持一致，放在 scrollable 之外） */}
        <div className="audio-panel__tags">
          {TAGS.map((tag) => (
            <button
              key={tag.query}
              className="audio-panel__tag"
              onClick={() => handleTagClick(tag)}
            >
              {tag.label}
            </button>
          ))}
        </div>

        {/* 可滚动区域：列表 + 分页，分页紧跟在列表最后一项之后 */}
        <div className="audio-panel__scrollable">
          <div className="audio-panel__list">
            {isLoading ? (
              // 骨架屏状态
              <>
                {Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className="audio-panel__skeleton-item">
                    <div className="audio-panel__skeleton-cover"></div>
                    <div className="audio-panel__skeleton-content">
                      <div className="audio-panel__skeleton-title"></div>
                      <div className="audio-panel__skeleton-subtitle"></div>
                    </div>
                    <div className="audio-panel__skeleton-duration"></div>
                  </div>
                ))}
              </>
            ) : (
              // 数据加载完成状态
              <>
                {error && (
                  <div className="audio-panel__error">
                    {error}
                    <button
                      type="button"
                      className="audio-panel__retry"
                      onClick={() => loadPage(queryForApi, 1, false)}
                    >
                      重试
                    </button>
                  </div>
                )}
                {tracks.map((track) => {
                  const isPlaying =
                    previewTrackId === track.id && isPreviewPlaying;
                  const progress =
                    track.durationSeconds > 0
                      ? Math.min(1, previewCurrentTime / track.durationSeconds)
                      : 0;

                  return (
                    <div
                      key={track.id}
                      className={`audio-panel__track-item ${
                        isPlaying ? "audio-panel__track-item--selected" : ""
                      }`}
                      onClick={() => {
                        void addTrackToProject(track);
                      }}
                      onMouseEnter={() => setHoveredTrackId(track.id)}
                      onMouseLeave={() => setHoveredTrackId(null)}
                    >
                      <div className="audio-panel__track-main">
                        <div className="audio-panel__track-cover">
                          {track.coverUrl ? (
                            <>
                              <img
                                src={track.coverUrl}
                                alt={track.title}
                                className="audio-panel__track-cover-image"
                              />
                              {(hoveredTrackId === track.id || isPlaying) && (
                                <button
                                  type="button"
                                  className="audio-panel__track-cover-play-overlay"
                                  onClick={(e) => handlePreviewClick(e, track)}
                                  aria-label={
                                    isPlaying ? "停止播放" : "试听音频"
                                  }
                                >
                                  {isPlaying ? (
                                    <Square size={16} fill="currentColor" />
                                  ) : (
                                    <Play size={16} fill="currentColor" />
                                  )}
                                </button>
                              )}
                            </>
                          ) : hoveredTrackId === track.id || isPlaying ? (
                            <button
                              type="button"
                              className="audio-panel__track-cover-play"
                              onClick={(e) => handlePreviewClick(e, track)}
                              aria-label={isPlaying ? "停止播放" : "试听音频"}
                            >
                              {isPlaying ? (
                                <Square size={16} fill="currentColor" />
                              ) : (
                                <Play size={16} fill="currentColor" />
                              )}
                            </button>
                          ) : (
                            <div className="audio-panel__track-cover-icon">
                              <Music size={20} />
                            </div>
                          )}
                        </div>
                        <div className="audio-panel__track-info">
                          <div className="audio-panel__track-title">
                            {track.title}
                          </div>
                          <div className="audio-panel__track-artist">
                            {track.artist}
                          </div>
                        </div>
                        <div className="audio-panel__track-duration">
                          {loadingTrackId === track.id
                            ? "加载中…"
                            : track.duration}
                        </div>
                      </div>

                      {previewTrackId === track.id && (
                        <div className="audio-panel__track-progress">
                          <span className="audio-panel__track-time">
                            {formatDuration(previewCurrentTime)}
                          </span>
                          <div
                            className="audio-panel__track-progress-bar"
                            onClick={(e) => handlePreviewSeek(e, track)}
                          >
                            <div
                              className="audio-panel__track-progress-fill"
                              style={{ width: `${progress * 100}%` }}
                            />
                          </div>
                          <span className="audio-panel__track-time">
                            {track.duration}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            )}
          </div>
          {showLoadMore && (
            <div className="audio-panel__pagination">
              <button
                type="button"
                className="audio-panel__load-more"
                disabled={isLoadingMore}
                onClick={() => setPage((p) => p + 1)}
              >
                {isLoadingMore ? "加载中…" : "加载更多"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
