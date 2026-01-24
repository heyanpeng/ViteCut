import { useState } from "react";
import { Monitor, ChevronDown, Check } from "lucide-react";
import "./CanvasPanel.css";

type CanvasSize = {
  label: string;
  value: string;
  group?: "social" | "general";
};

const canvasSizes: CanvasSize[] = [
  // 社交媒体预设
  { label: "YouTube — 16:9", value: "youtube-16:9", group: "social" },
  { label: "YouTube Shorts — 9:16", value: "youtube-shorts-9:16", group: "social" },
  { label: "TikTok — 9:16", value: "tiktok-9:16", group: "social" },
  { label: "Instagram Story & Reels — 9:16", value: "instagram-story-9:16", group: "social" },
  { label: "Instagram Post Square — 1:1", value: "instagram-square-1:1", group: "social" },
  { label: "Instagram Post — 4:5", value: "instagram-post-4:5", group: "social" },
  { label: "Spotify Canvas — 9:16", value: "spotify-9:16", group: "social" },
  { label: "Facebook Story — 9:16", value: "facebook-story-9:16", group: "social" },
  { label: "Snapchat Story — 9:16", value: "snapchat-story-9:16", group: "social" },
  // 通用预设
  { label: "Widescreen — 16:9", value: "16:9", group: "general" },
  { label: "Full Portrait — 9:16", value: "9:16", group: "general" },
  { label: "Square — 1:1", value: "1:1", group: "general" },
  { label: "Landscape — 4:3", value: "4:3", group: "general" },
  { label: "Portrait — 4:5", value: "4:5", group: "general" },
  { label: "Landscape Post — 5:4", value: "5:4", group: "general" },
  { label: "Vertical — 2:3", value: "2:3", group: "general" },
  { label: "Ultrawide — 21:9", value: "21:9", group: "general" },
];

type BackgroundColor =
  | { type: "gradient"; colors: string[] }
  | { type: "solid"; color: string };

const backgroundColors: BackgroundColor[] = [
  // 第一行
  { type: "gradient", colors: ["#ff0000", "#ff7f00", "#ffff00", "#00ff00", "#0000ff", "#4b0082", "#9400d3"] }, // 彩虹渐变
  { type: "solid", color: "#000000" }, // 黑色
  { type: "solid", color: "#ffffff" }, // 白色
  { type: "solid", color: "#ff0000" }, // 红色
  { type: "solid", color: "#ff7f00" }, // 橙色
  { type: "solid", color: "#ffff00" }, // 黄色
  { type: "solid", color: "#00ff00" }, // 绿色
  { type: "solid", color: "#0000ff" }, // 蓝色
  { type: "solid", color: "#800080" }, // 紫色
  { type: "solid", color: "#ffc0cb" }, // 粉色
  // 第二行
  { type: "solid", color: "#808080" }, // 灰色
  { type: "solid", color: "#f5f5dc" }, // 米色
  { type: "solid", color: "#90ee90" }, // 浅绿色
  { type: "solid", color: "#add8e6" }, // 浅蓝色
  { type: "solid", color: "#ffb6c1" }, // 浅粉色
  { type: "gradient", colors: ["#000080", "#0000ff"] }, // 深蓝色渐变
  { type: "gradient", colors: ["#ff7f00", "#ffa500"] }, // 橙色渐变
  { type: "gradient", colors: ["#00ff00", "#90ee90"] }, // 绿色渐变
  { type: "gradient", colors: ["#add8e6", "#e0f6ff"] }, // 浅蓝色渐变
  { type: "gradient", colors: ["#ffc0cb", "#ffb6c1"] }, // 粉色渐变
];

export function CanvasPanel() {
  const [selectedSize, setSelectedSize] = useState("16:9");
  const [isSizeDropdownOpen, setIsSizeDropdownOpen] = useState(false);

  const selectedSizeLabel = canvasSizes.find((s) => s.value === selectedSize)?.label || "Widescreen — 16:9";
  
  const socialSizes = canvasSizes.filter((s) => s.group === "social");
  const generalSizes = canvasSizes.filter((s) => s.group === "general");

  return (
    <div className="canvas-panel">
      <div className="canvas-panel__content">
        {/* 调整大小部分 */}
        <div className="canvas-panel__section">
          <h3 className="canvas-panel__section-title">调整大小</h3>
          <div className="canvas-panel__size-selector">
            <Monitor size={16} className="canvas-panel__monitor-icon" />
            <div
              className="canvas-panel__size-dropdown"
              onClick={() => setIsSizeDropdownOpen(!isSizeDropdownOpen)}
            >
              <span className="canvas-panel__size-label">{selectedSizeLabel}</span>
              <ChevronDown size={16} className="canvas-panel__chevron-icon" />
            </div>
            {isSizeDropdownOpen && (
              <div className="canvas-panel__dropdown-menu">
                {socialSizes.map((size) => (
                  <div
                    key={size.value}
                    className={`canvas-panel__dropdown-item ${
                      selectedSize === size.value ? "canvas-panel__dropdown-item--selected" : ""
                    }`}
                    onClick={() => {
                      setSelectedSize(size.value);
                      setIsSizeDropdownOpen(false);
                    }}
                  >
                    <span>{size.label}</span>
                    {selectedSize === size.value && (
                      <Check size={16} className="canvas-panel__check-icon" />
                    )}
                  </div>
                ))}
                <div className="canvas-panel__dropdown-divider"></div>
                {generalSizes.map((size) => (
                  <div
                    key={size.value}
                    className={`canvas-panel__dropdown-item ${
                      selectedSize === size.value ? "canvas-panel__dropdown-item--selected" : ""
                    }`}
                    onClick={() => {
                      setSelectedSize(size.value);
                      setIsSizeDropdownOpen(false);
                    }}
                  >
                    <span>{size.label}</span>
                    {selectedSize === size.value && (
                      <Check size={16} className="canvas-panel__check-icon" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 背景部分 */}
        <div className="canvas-panel__section">
          <h3 className="canvas-panel__section-title">背景</h3>
          <div className="canvas-panel__color-grid">
            {backgroundColors.map((bg, index) => {
              const backgroundStyle =
                bg.type === "gradient"
                  ? `linear-gradient(135deg, ${bg.colors.join(", ")})`
                  : bg.color;
              const titleText = bg.type === "gradient" ? "颜色选择器" : bg.color;
              
              return (
                <div
                  key={index}
                  className="canvas-panel__color-item"
                  style={{ background: backgroundStyle }}
                  title={titleText}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
