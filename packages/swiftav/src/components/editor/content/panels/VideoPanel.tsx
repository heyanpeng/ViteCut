import { useState, useEffect } from "react";
import { Search } from "lucide-react";
import "./VideoPanel.css";

type VideoItem = {
  id: string;
  title: string;
  duration: string;
  thumbnailUrl: string;
  aspectRatio?: "landscape" | "portrait";
};

const mockVideos: VideoItem[] = [
  {
    id: "1",
    title: "Forest Waterfall",
    duration: "0:05",
    thumbnailUrl: "https://cdn.pixabay.com/video/2026/01/18/328640_tiny.jpg",
    aspectRatio: "landscape",
  },
  {
    id: "2",
    title: "Abstract Background",
    duration: "0:07",
    thumbnailUrl: "https://cdn.pixabay.com/video/2026/01/18/328640_tiny.jpg",
    aspectRatio: "landscape",
  },
  {
    id: "3",
    title: "Golden Particles",
    duration: "0:10",
    thumbnailUrl: "https://cdn.pixabay.com/video/2026/01/18/328640_tiny.jpg",
    aspectRatio: "landscape",
  },
  {
    id: "4",
    title: "Fitness Training",
    duration: "0:07",
    thumbnailUrl: "https://cdn.pixabay.com/video/2026/01/18/328640_tiny.jpg",
    aspectRatio: "landscape",
  },
  {
    id: "5",
    title: "Stream in Forest",
    duration: "0:20",
    thumbnailUrl: "https://cdn.pixabay.com/video/2026/01/18/328640_tiny.jpg",
    aspectRatio: "portrait",
  },
  {
    id: "6",
    title: "Rocky Riverbed",
    duration: "0:10",
    thumbnailUrl: "https://cdn.pixabay.com/video/2026/01/18/328640_tiny.jpg",
    aspectRatio: "portrait",
  },
  {
    id: "7",
    title: "Castle at Night",
    duration: "0:27",
    thumbnailUrl: "https://cdn.pixabay.com/video/2026/01/18/328640_tiny.jpg",
    aspectRatio: "portrait",
  },
  {
    id: "8",
    title: "Snowy Landscape",
    duration: "0:13",
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

export function VideoPanel() {
  const [isLoading, setIsLoading] = useState(true);
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
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
    <div className="video-panel">
      <div className="video-panel__content">
        {/* 顶部功能区 */}
        <div className="video-panel__header">
          <div className="video-panel__search">
            <Search size={16} className="video-panel__search-icon" />
            <input
              type="text"
              placeholder="搜索视频..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="video-panel__search-input"
            />
          </div>
        </div>

        {/* 可滚动区域 */}
        <div className="video-panel__scrollable">
          {/* 标签筛选区 */}
          <div className="video-panel__tags">
            {tags.map((tag) => (
              <button
                key={tag}
                className="video-panel__tag"
                onClick={() => handleTagClick(tag)}
              >
                {tag}
              </button>
            ))}
          </div>

          {/* 视频网格 */}
          <div className="video-panel__grid">
            {isLoading ? (
              // 骨架屏状态
              <>
                {Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className="video-panel__skeleton-item">
                    <div className="video-panel__skeleton-thumbnail"></div>
                  </div>
                ))}
              </>
            ) : (
              // 数据加载完成状态
              <>
                {mockVideos.map((video) => (
                  <div
                    key={video.id}
                    className={`video-panel__video-item ${
                      selectedVideoId === video.id
                        ? "video-panel__video-item--selected"
                        : ""
                    } ${
                      video.aspectRatio === "portrait"
                        ? "video-panel__video-item--portrait"
                        : ""
                    }`}
                    onClick={() => setSelectedVideoId(video.id)}
                  >
                    <div className="video-panel__video-thumbnail">
                      <img
                        src={video.thumbnailUrl}
                        alt={video.title}
                        className="video-panel__video-thumbnail-image"
                      />
                      <div className="video-panel__video-duration">
                        {video.duration}
                      </div>
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
