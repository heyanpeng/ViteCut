import { useState, useEffect } from "react";
import { Search } from "lucide-react";
import "./ImagePanel.css";

type ImageItem = {
  id: string;
  title: string;
  thumbnailUrl: string;
  aspectRatio?: "landscape" | "portrait";
};

const mockImages: ImageItem[] = [
  {
    id: "1",
    title: "Forest Waterfall",
    thumbnailUrl: "https://cdn.pixabay.com/video/2026/01/18/328640_tiny.jpg",
    aspectRatio: "landscape",
  },
  {
    id: "2",
    title: "Abstract Background",
    thumbnailUrl: "https://cdn.pixabay.com/video/2026/01/18/328640_tiny.jpg",
    aspectRatio: "landscape",
  },
  {
    id: "3",
    title: "Golden Particles",
    thumbnailUrl: "https://cdn.pixabay.com/video/2026/01/18/328640_tiny.jpg",
    aspectRatio: "landscape",
  },
  {
    id: "4",
    title: "Fitness Training",
    thumbnailUrl: "https://cdn.pixabay.com/video/2026/01/18/328640_tiny.jpg",
    aspectRatio: "landscape",
  },
  {
    id: "5",
    title: "Stream in Forest",
    thumbnailUrl: "https://cdn.pixabay.com/video/2026/01/18/328640_tiny.jpg",
    aspectRatio: "portrait",
  },
  {
    id: "6",
    title: "Rocky Riverbed",
    thumbnailUrl: "https://cdn.pixabay.com/video/2026/01/18/328640_tiny.jpg",
    aspectRatio: "portrait",
  },
  {
    id: "7",
    title: "Castle at Night",
    thumbnailUrl: "https://cdn.pixabay.com/video/2026/01/18/328640_tiny.jpg",
    aspectRatio: "portrait",
  },
  {
    id: "8",
    title: "Snowy Landscape",
    thumbnailUrl: "https://cdn.pixabay.com/video/2026/01/18/328640_tiny.jpg",
    aspectRatio: "landscape",
  },
];

const tags = [
  "背景", // background
  "旅行", // travel
  "自然", // nature
  "花朵", // flowers
  "天空", // sky
  "日落", // sunset
  "水", // water
  "食物", // food
  "人物", // people
  "动物", // animals
];

export function ImagePanel() {
  const [isLoading, setIsLoading] = useState(true);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // 模拟数据加载
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  const handleTagClick = (tag: string) => {
    setSearchQuery(tag);
  };

  return (
    <div className="image-panel">
      <div className="image-panel__content">
        {/* 顶部功能区 */}
        <div className="image-panel__header">
          <div className="image-panel__search">
            <Search size={16} className="image-panel__search-icon" />
            <input
              type="text"
              placeholder="搜索图像..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="image-panel__search-input"
            />
          </div>
        </div>

        {/* 可滚动区域 */}
        <div className="image-panel__scrollable">
          {/* 标签筛选区 */}
          <div className="image-panel__tags">
            {tags.map((tag) => (
              <button
                key={tag}
                className="image-panel__tag"
                onClick={() => handleTagClick(tag)}
              >
                {tag}
              </button>
            ))}
          </div>

          {/* 图像网格 */}
          <div className="image-panel__grid">
            {isLoading ? (
              // 骨架屏状态
              <>
                {Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className="image-panel__skeleton-item">
                    <div className="image-panel__skeleton-thumbnail"></div>
                  </div>
                ))}
              </>
            ) : (
              // 数据加载完成状态
              <>
                {mockImages.map((image) => (
                  <div
                    key={image.id}
                    className={`image-panel__image-item ${
                      selectedImageId === image.id
                        ? "image-panel__image-item--selected"
                        : ""
                    } ${
                      image.aspectRatio === "portrait"
                        ? "image-panel__image-item--portrait"
                        : ""
                    }`}
                    onClick={() => setSelectedImageId(image.id)}
                  >
                    <div className="image-panel__image-thumbnail">
                      <img
                        src={image.thumbnailUrl}
                        alt={image.title}
                        className="image-panel__image-thumbnail-image"
                      />
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
