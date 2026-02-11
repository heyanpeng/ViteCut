import { useState, useRef, useEffect } from "react";
import {
  Monitor,
  ChevronDown,
  Check,
  Video,
  Smartphone,
  Tablet,
  Square,
  RectangleHorizontal,
  RectangleVertical,
  Maximize2,
} from "lucide-react";
import "./CanvasPanel.css";
import { useProjectStore } from "@/stores";

type CanvasSize = {
  label: string;
  value: string;
  group?: "social" | "general";
  icon?: React.ComponentType<{ size?: number; className?: string }>;
};

const canvasSizes: CanvasSize[] = [
  // 社交媒体预设
  { label: "抖音 — 9:16", value: "douyin-9:16", group: "social", icon: Video },
  {
    label: "抖音横屏 — 16:9",
    value: "douyin-landscape-16:9",
    group: "social",
    icon: Monitor,
  },
  { label: "快手 — 9:16", value: "kuaishou-9:16", group: "social", icon: Video },
  {
    label: "小红书 — 3:4",
    value: "xiaohongshu-3:4",
    group: "social",
    icon: Tablet,
  },
  {
    label: "小红书方形 — 1:1",
    value: "xiaohongshu-square-1:1",
    group: "social",
    icon: Square,
  },
  {
    label: "视频号 — 16:9",
    value: "wechat-video-16:9",
    group: "social",
    icon: Monitor,
  },
  {
    label: "视频号竖屏 — 9:16",
    value: "wechat-video-9:16",
    group: "social",
    icon: Smartphone,
  },
  { label: "B站 — 16:9", value: "bilibili-16:9", group: "social", icon: Monitor },
  {
    label: "B站竖屏 — 9:16",
    value: "bilibili-9:16",
    group: "social",
    icon: Smartphone,
  },
  // 通用预设
  { label: "宽屏 — 16:9", value: "16:9", group: "general", icon: RectangleHorizontal },
  { label: "竖屏 — 9:16", value: "9:16", group: "general", icon: RectangleVertical },
  { label: "方形 — 1:1", value: "1:1", group: "general", icon: Square },
  { label: "横屏 — 4:3", value: "4:3", group: "general", icon: RectangleHorizontal },
  { label: "竖屏 — 4:5", value: "4:5", group: "general", icon: RectangleVertical },
  { label: "横屏海报 — 5:4", value: "5:4", group: "general", icon: RectangleHorizontal },
  { label: "竖屏 — 2:3", value: "2:3", group: "general", icon: RectangleVertical },
  { label: "超宽屏 — 21:9", value: "21:9", group: "general", icon: Maximize2 },
];

type BackgroundColor =
  | { type: "gradient"; colors: string[] }
  | { type: "solid"; color: string };

const backgroundColors: BackgroundColor[] = [
  // 第一行
  {
    type: "gradient",
    colors: [
      "#ff0000",
      "#ff7f00",
      "#ffff00",
      "#00ff00",
      "#0000ff",
      "#4b0082",
      "#9400d3",
    ],
  }, // 彩虹渐变
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
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  const selectedSizeLabel =
    canvasSizes.find((s) => s.value === selectedSize)?.label ||
    "Widescreen — 16:9";

  const socialSizes = canvasSizes.filter((s) => s.group === "social");
  const generalSizes = canvasSizes.filter((s) => s.group === "general");
  const setCanvasBackgroundColor = useProjectStore((s) => s.setCanvasBackgroundColor);


  useEffect(() => {
    if (isSizeDropdownOpen) {
      const handleClickOutside = (event: MouseEvent) => {
        if (
          dropdownRef.current &&
          !dropdownRef.current.contains(event.target as Node) &&
          triggerRef.current &&
          !triggerRef.current.contains(event.target as Node)
        ) {
          setIsSizeDropdownOpen(false);
        }
      };
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [isSizeDropdownOpen]);

  return (
    <div className="canvas-panel">
      <div className="canvas-panel__content">
        {/* 调整大小部分 */}
        <div className="canvas-panel__section">
          <h3 className="canvas-panel__section-title">调整大小</h3>
          <div
            ref={triggerRef}
            className="canvas-panel__size-selector"
            onClick={() => setIsSizeDropdownOpen(!isSizeDropdownOpen)}
          >
            <Monitor size={16} className="canvas-panel__monitor-icon" />
            <div className="canvas-panel__size-dropdown">
              <span className="canvas-panel__size-label">
                {selectedSizeLabel}
              </span>
              <ChevronDown size={16} className="canvas-panel__chevron-icon" />
            </div>
            {isSizeDropdownOpen && (
              <div ref={dropdownRef} className="canvas-panel__dropdown-menu">
                {socialSizes.map((size) => {
                  const IconComponent = size.icon || Monitor;
                  return (
                    <div
                      key={size.value}
                      className={`canvas-panel__dropdown-item ${
                        selectedSize === size.value
                          ? "canvas-panel__dropdown-item--selected"
                          : ""
                      }`}
                      onClick={() => {
                        setSelectedSize(size.value);
                        setIsSizeDropdownOpen(false);
                      }}
                    >
                      <IconComponent size={16} className="canvas-panel__item-icon" />
                      <span>{size.label}</span>
                      {selectedSize === size.value && (
                        <Check size={16} className="canvas-panel__check-icon" />
                      )}
                    </div>
                  );
                })}
                <div className="canvas-panel__dropdown-divider"></div>
                {generalSizes.map((size) => {
                  const IconComponent = size.icon || Monitor;
                  return (
                    <div
                      key={size.value}
                      className={`canvas-panel__dropdown-item ${
                        selectedSize === size.value
                          ? "canvas-panel__dropdown-item--selected"
                          : ""
                      }`}
                      onClick={() => {
                        setSelectedSize(size.value);
                        setIsSizeDropdownOpen(false);
                      }}
                    >
                      <IconComponent size={16} className="canvas-panel__item-icon" />
                      <span>{size.label}</span>
                      {selectedSize === size.value && (
                        <Check size={16} className="canvas-panel__check-icon" />
                      )}
                    </div>
                  );
                })}
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
              const colorToSet =
                bg.type === "gradient" ? bg.colors[0] : bg.color;
              const titleText =
                bg.type === "gradient" ? "颜色选择器" : bg.color;

              return (
                <div
                  key={index}
                  className="canvas-panel__color-item"
                  style={{ background: backgroundStyle }}
                  title={titleText}
                  onClick={() => setCanvasBackgroundColor(colorToSet)}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
