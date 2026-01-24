import { useState, useEffect, useRef } from "react";
import { Search, ChevronDown, Filter, Music, Play } from "lucide-react";
import "./AudioPanel.css";

type AudioTrack = {
  id: string;
  title: string;
  artist: string;
  duration: string;
  coverUrl?: string;
};

const mockTracks: AudioTrack[] = [
  {
    id: "1",
    title: "Lofi Study",
    artist: "FASSounds",
    duration: "2:27",
    coverUrl:
      "https://s1.clideo.com/stocks/pixabay/thumbs/audio_music_33106_1f75b2fc.png",
  },
  {
    id: "2",
    title: "The Cradle of Your Soul",
    artist: "lemonmusicstudio",
    duration: "2:58",
    coverUrl:
      "https://s1.clideo.com/stocks/pixabay/thumbs/audio_music_33106_1f75b2fc.png",
  },
  {
    id: "3",
    title: "Forest Lullaby",
    artist: "Lesfm",
    duration: "3:16",
  },
  {
    id: "4",
    title: "Piano Moment",
    artist: "Benjamin Tissot",
    duration: "1:43",
  },
  {
    id: "5",
    title: "Ambient Piano & Strings",
    artist: "Daddy_s_Music",
    duration: "3:37",
  },
  {
    id: "6",
    title: "Happy Day",
    artist: "Stockaudios",
    duration: "2:50",
    coverUrl:
      "https://s1.clideo.com/stocks/pixabay/thumbs/audio_music_33106_1f75b2fc.png",
  },
  {
    id: "7",
    title: "Just Relax",
    artist: "Lesfm",
    duration: "2:15",
  },
  {
    id: "8",
    title: "Relaxed Vlog (Night Street)",
    artist: "Ashot-Danielyan-Composer",
    duration: "2:21",
    coverUrl:
      "https://s1.clideo.com/stocks/pixabay/thumbs/audio_music_33106_1f75b2fc.png",
  },
  {
    id: "9",
    title: "Chill Abstract",
    artist: "Benjamin Tissot",
    duration: "3:05",
  },
];

const tags = [
  "背景音乐", // background music
  "放松", // relaxing
  "欢快", // upbeat
  "快乐", // happy
  "节拍", // beats
  "Vlog音乐", // vlog music
  "激励", // motivation
  "搞笑", // funny
  "企业", // corporate
  "器乐", // instrumental
];

export function AudioPanel() {
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("音乐");
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const categoryRef = useRef<HTMLDivElement>(null);

  const categories = ["音乐", "音效"];

  // 模拟数据加载
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
      // 数据加载完成后，默认选中 "Just Relax"
      setSelectedTrackId("7");
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  // 点击外部关闭下拉菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        categoryRef.current &&
        !categoryRef.current.contains(event.target as Node)
      ) {
        setIsCategoryOpen(false);
      }
    };

    if (isCategoryOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isCategoryOpen]);

  const handleTagClick = (tag: string) => {
    setSearchQuery(tag);
  };

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
              className="audio-panel__search-input"
            />
          </div>
          <div className="audio-panel__header-controls">
            <div
              ref={categoryRef}
              className="audio-panel__category"
              onClick={() => setIsCategoryOpen(!isCategoryOpen)}
            >
              <span>{selectedCategory}</span>
              <ChevronDown size={14} />
              {isCategoryOpen && (
                <div className="audio-panel__category-dropdown">
                  {categories.map((category) => (
                    <div
                      key={category}
                      className={`audio-panel__category-option ${
                        selectedCategory === category
                          ? "audio-panel__category-option--selected"
                          : ""
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedCategory(category);
                        setIsCategoryOpen(false);
                      }}
                    >
                      {category}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button className="audio-panel__filter-btn">
              <Filter size={16} />
            </button>
          </div>
        </div>

        {/* 可滚动区域 */}
        <div className="audio-panel__scrollable">
          {/* 标签筛选区 */}
          <div className="audio-panel__tags">
            {tags.map((tag) => (
              <button
                key={tag}
                className="audio-panel__tag"
                onClick={() => handleTagClick(tag)}
              >
                {tag}
              </button>
            ))}
          </div>

          {/* 音频列表 */}
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
                {mockTracks.map((track) => (
                  <div
                    key={track.id}
                    className={`audio-panel__track-item ${
                      selectedTrackId === track.id
                        ? "audio-panel__track-item--selected"
                        : ""
                    }`}
                    onClick={() => setSelectedTrackId(track.id)}
                  >
                    <div className="audio-panel__track-cover">
                      {track.coverUrl ? (
                        <>
                          <img
                            src={track.coverUrl}
                            alt={track.title}
                            className="audio-panel__track-cover-image"
                          />
                          {selectedTrackId === track.id && (
                            <div className="audio-panel__track-cover-play-overlay">
                              <Play size={16} fill="currentColor" />
                            </div>
                          )}
                        </>
                      ) : selectedTrackId === track.id ? (
                        <div className="audio-panel__track-cover-play">
                          <Play size={16} fill="currentColor" />
                        </div>
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
                      {track.duration}
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
