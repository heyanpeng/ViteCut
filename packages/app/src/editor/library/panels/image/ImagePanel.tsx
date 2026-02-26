import { useState, useEffect, useCallback } from "react";
import { Search, Maximize2, Upload, Plus } from "lucide-react";
import { Dialog } from "radix-ui";
import { useProjectStore } from "@/stores/projectStore";
import { add as addToMediaStorage } from "@/utils/mediaStorage";
import "./ImagePanel.css";

const PEXELS_PHOTOS_API_BASE = "https://api.pexels.com/v1";
const PER_PAGE = 15;

type PexelsPhotoSrc = {
  original: string;
  large2x: string;
  large: string;
  medium: string;
  small: string;
  portrait: string;
  landscape: string;
  tiny: string;
};

type PexelsPhoto = {
  id: number;
  width: number;
  height: number;
  url: string;
  photographer: string;
  photographer_url: string;
  photographer_id: number;
  avg_color: string;
  src: PexelsPhotoSrc;
  alt: string | null;
};

type PexelsSearchResponse = {
  page: number;
  per_page: number;
  photos: PexelsPhoto[];
  total_results: number;
  next_page?: string;
  prev_page?: string;
};

type ImageItem = {
  id: string;
  title: string;
  thumbnailUrl: string;
  imageUrl: string;
  aspectRatio: "landscape" | "portrait";
  width?: number;
  height?: number;
  photographer?: string;
};

type DisplayImageItem = ImageItem & { column: 0 | 1 };

function mapPexelsToItem(p: PexelsPhoto): ImageItem {
  const aspectRatio: "landscape" | "portrait" =
    p.width >= p.height ? "landscape" : "portrait";
  return {
    id: String(p.id),
    title: p.alt ?? `Photo ${p.id}`,
    thumbnailUrl: p.src.medium ?? p.src.small ?? p.src.original,
    imageUrl: p.src.large2x ?? p.src.large ?? p.src.original,
    aspectRatio,
    width: p.width,
    height: p.height,
    photographer: p.photographer,
  };
}

async function fetchPexelsPhotos(
  query: string,
  page: number
): Promise<PexelsSearchResponse> {
  const params = new URLSearchParams({
    query: query || "nature",
    per_page: String(PER_PAGE),
    page: String(page),
  });
  const url = `${PEXELS_PHOTOS_API_BASE}/search?${params}`;
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

export function ImagePanel() {
  const [images, setImages] = useState<DisplayImageItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalResults, setTotalResults] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [queryForApi, setQueryForApi] = useState("nature");

  const loadPage = useCallback(
    async (q: string, pageNum: number, append: boolean) => {
      const setLoading = append ? setIsLoadingMore : setIsLoading;
      setLoading(true);
      setError(null);
      try {
        const data = await fetchPexelsPhotos(q, pageNum);
        const items = data.photos.map(mapPexelsToItem);

        // 按列高度将图片分配到两列，append 时只给新增的图片分配列，避免已有位置变化
        setImages((prev) => {
          const prevList = append ? prev : [];
          const colHeights: [number, number] = [0, 0];

          // 根据已有图片的列信息累计高度（使用宽高比近似）
          if (append) {
            for (const img of prevList) {
              const ratio =
                img.width && img.height ? img.height / img.width : 1;
              colHeights[img.column] += ratio;
            }
          }

          const next: DisplayImageItem[] = [...prevList];
          for (const img of items) {
            const ratio = img.width && img.height ? img.height / img.width : 1;
            const col = colHeights[0] <= colHeights[1] ? 0 : 1;
            colHeights[col] += ratio;
            next.push({ ...img, column: col });
          }

          return next;
        });
        setTotalResults(data.total_results);
      } catch (e) {
        setError(e instanceof Error ? e.message : "加载失败");
        if (!append) {
          setImages([]);
        }
      } finally {
        setLoading(false);
      }
    },
    []
  );

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

  const hasMore = images.length < totalResults;
  const showLoadMore = !isLoading && !error && hasMore && images.length > 0;

  const [previewImage, setPreviewImage] = useState<ImageItem | null>(null);
  const addMediaPlaceholder = useProjectStore((s) => s.addMediaPlaceholder);
  const resolveMediaPlaceholder = useProjectStore(
    (s) => s.resolveMediaPlaceholder
  );

  const addImageToCanvas = useCallback(
    async (image: ImageItem) => {
      const ids = addMediaPlaceholder({
        name: `pexels-${image.id}.jpg`,
        kind: "image",
        sourceUrl: image.imageUrl,
      });
      try {
        const res = await fetch(image.imageUrl);
        const blob = await res.blob();
        const file = new File([blob], `pexels-${image.id}.jpg`, {
          type: blob.type || "image/jpeg",
        });
        await resolveMediaPlaceholder(ids, file);
        setPreviewImage(null);
      } catch (err) {
        await resolveMediaPlaceholder(ids, null);
        console.error("添加图片到画板失败:", err);
      }
    },
    [addMediaPlaceholder, resolveMediaPlaceholder]
  );

  const handleAddToTimeline = useCallback(
    async (image: ImageItem) => {
      await addImageToCanvas(image);
    },
    [addImageToCanvas]
  );

  const handleAddToLibrary = useCallback(async (image: ImageItem) => {
    await addToMediaStorage({
      id: `pexels-image-${image.id}`,
      name: `pexels-${image.id}.jpg`,
      type: "image",
      addedAt: Date.now(),
      url: image.imageUrl,
    });
    setPreviewImage(null);
  }, []);

  return (
    <div className="image-panel">
      <div className="image-panel__content">
        <div className="image-panel__header">
          <div className="image-panel__search">
            <Search size={16} className="image-panel__search-icon" />
            <input
              type="text"
              placeholder="搜索图像..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSearchSubmit();
                }
              }}
              className="image-panel__search-input"
            />
          </div>
        </div>

        <div className="image-panel__tags">
          {TAGS.map((tag) => (
            <button
              key={tag.query}
              className="image-panel__tag"
              onClick={() => handleTagClick(tag)}
            >
              {tag.label}
            </button>
          ))}
        </div>

        <div className="image-panel__scrollable">
          {error && (
            <div className="image-panel__error">
              {error}
              <button
                type="button"
                className="image-panel__retry"
                onClick={() => loadPage(queryForApi, 1, false)}
              >
                重试
              </button>
            </div>
          )}

          {isLoading ? (
            <div className="image-panel__grid">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="image-panel__skeleton-item">
                  <div className="image-panel__skeleton-thumbnail"></div>
                </div>
              ))}
            </div>
          ) : (
            <div className="image-panel__grid">
              {[0, 1].map((col) => (
                <div key={col} className="image-panel__column">
                  {images
                    .filter((image) => image.column === col)
                    .map((image) => (
                      <div
                        key={image.id}
                        className="image-panel__image-item"
                        onClick={() => {
                          void addImageToCanvas(image);
                        }}
                      >
                        <div className="image-panel__image-thumbnail">
                          <img
                            src={image.thumbnailUrl}
                            alt={image.title}
                            className="image-panel__image-thumbnail-image"
                          />
                          <button
                            type="button"
                            className="image-panel__zoom-btn"
                            aria-label="查看详情"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPreviewImage(image);
                            }}
                          >
                            <Maximize2 size={18} />
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              ))}
            </div>
          )}

          {showLoadMore && (
            <div className="image-panel__pagination">
              <button
                type="button"
                className="image-panel__load-more"
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
        open={previewImage !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPreviewImage(null);
          }
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="image-panel__dialog-overlay" />
          {previewImage && (
            <Dialog.Content className="image-panel__dialog-content">
              <button
                type="button"
                className="image-panel__dialog-close"
                aria-label="关闭"
                onClick={() => setPreviewImage(null)}
              >
                ×
              </button>
              <div className="image-panel__dialog-media">
                <img
                  src={previewImage.imageUrl}
                  alt={previewImage.title}
                  className="image-panel__dialog-image"
                />
                <div className="image-panel__dialog-info">
                  <div className="image-panel__dialog-meta">
                    {previewImage.width != null &&
                      previewImage.height != null && (
                        <span>
                          {previewImage.width} × {previewImage.height}
                        </span>
                      )}
                    {previewImage.photographer && (
                      <span>作者 {previewImage.photographer}</span>
                    )}
                  </div>
                  <div className="image-panel__dialog-actions">
                    <button
                      type="button"
                      className="image-panel__dialog-btn image-panel__dialog-btn--secondary"
                      onClick={() => handleAddToLibrary(previewImage)}
                    >
                      <Upload size={16} />
                      添加到媒体库
                    </button>
                    <button
                      type="button"
                      className="image-panel__dialog-btn image-panel__dialog-btn--primary"
                      onClick={async () => {
                        const image = previewImage;
                        if (!image) return;
                        setPreviewImage(null);
                        await handleAddToTimeline(image);
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
