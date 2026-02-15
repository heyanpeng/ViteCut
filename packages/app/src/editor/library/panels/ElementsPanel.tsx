import { useState } from "react";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { useProjectStore } from "@/stores";
import "./ElementsPanel.css";

/**
 * 形状定义：每个形状有名称、SVG 路径、viewBox 尺寸和默认颜色。
 * SVG 会被转为 data URL 作为图片 source 添加到画布。
 */
type ShapeDefinition = {
  id: string;
  name: string;
  /** SVG 内容（不含 <svg> 外壳，仅内部元素） */
  svgContent: string;
  /** viewBox 宽高 */
  width: number;
  height: number;
  /** 默认填充色 */
  fill: string;
};

/**
 * 常用形状列表
 */
const shapes: ShapeDefinition[] = [
  {
    id: "rect",
    name: "矩形",
    svgContent: `<rect x="0" y="0" width="200" height="200" rx="0" />`,
    width: 200,
    height: 200,
    fill: "#4A90D9",
  },
  {
    id: "rounded-rect",
    name: "圆角矩形",
    svgContent: `<rect x="0" y="0" width="200" height="200" rx="24" />`,
    width: 200,
    height: 200,
    fill: "#7B68EE",
  },
  {
    id: "circle",
    name: "圆形",
    svgContent: `<circle cx="100" cy="100" r="100" />`,
    width: 200,
    height: 200,
    fill: "#E74C3C",
  },
  {
    id: "ellipse",
    name: "椭圆",
    svgContent: `<ellipse cx="120" cy="80" rx="120" ry="80" />`,
    width: 240,
    height: 160,
    fill: "#F39C12",
  },
  {
    id: "triangle",
    name: "三角形",
    svgContent: `<polygon points="100,0 200,200 0,200" />`,
    width: 200,
    height: 200,
    fill: "#2ECC71",
  },
  {
    id: "diamond",
    name: "菱形",
    svgContent: `<polygon points="100,0 200,100 100,200 0,100" />`,
    width: 200,
    height: 200,
    fill: "#E67E22",
  },
  {
    id: "pentagon",
    name: "五边形",
    svgContent: `<polygon points="100,0 195,69 159,181 41,181 5,69" />`,
    width: 200,
    height: 181,
    fill: "#9B59B6",
  },
  {
    id: "hexagon",
    name: "六边形",
    svgContent: `<polygon points="50,0 150,0 200,87 150,173 50,173 0,87" />`,
    width: 200,
    height: 173,
    fill: "#1ABC9C",
  },
  {
    id: "star-5",
    name: "五角星",
    svgContent: `<polygon points="100,0 129,63 200,73 148,121 162,192 100,158 38,192 52,121 0,73 71,63" />`,
    width: 200,
    height: 192,
    fill: "#F1C40F",
  },
  {
    id: "star-4",
    name: "四角星",
    svgContent: `<polygon points="100,0 120,80 200,100 120,120 100,200 80,120 0,100 80,80" />`,
    width: 200,
    height: 200,
    fill: "#E74C3C",
  },
  {
    id: "arrow-right",
    name: "右箭头",
    svgContent: `<polygon points="0,50 140,50 140,0 200,87 140,173 140,123 0,123" />`,
    width: 200,
    height: 173,
    fill: "#3498DB",
  },
  {
    id: "arrow-left",
    name: "左箭头",
    svgContent: `<polygon points="200,50 60,50 60,0 0,87 60,173 60,123 200,123" />`,
    width: 200,
    height: 173,
    fill: "#3498DB",
  },
  {
    id: "heart",
    name: "爱心",
    svgContent: `<path d="M100,180 C40,130 0,90 0,55 C0,25 25,0 55,0 C75,0 92,12 100,30 C108,12 125,0 145,0 C175,0 200,25 200,55 C200,90 160,130 100,180Z" />`,
    width: 200,
    height: 180,
    fill: "#E74C3C",
  },
  {
    id: "cross",
    name: "十字",
    svgContent: `<polygon points="70,0 130,0 130,70 200,70 200,130 130,130 130,200 70,200 70,130 0,130 0,70 70,70" />`,
    width: 200,
    height: 200,
    fill: "#E74C3C",
  },
  {
    id: "octagon",
    name: "八边形",
    svgContent: `<polygon points="59,0 141,0 200,59 200,141 141,200 59,200 0,141 0,59" />`,
    width: 200,
    height: 200,
    fill: "#C0392B",
  },
  {
    id: "parallelogram",
    name: "平行四边形",
    svgContent: `<polygon points="40,0 200,0 160,120 0,120" />`,
    width: 200,
    height: 120,
    fill: "#2980B9",
  },
  {
    id: "trapezoid",
    name: "梯形",
    svgContent: `<polygon points="40,0 160,0 200,120 0,120" />`,
    width: 200,
    height: 120,
    fill: "#8E44AD",
  },
  {
    id: "ring",
    name: "圆环",
    svgContent: `<circle cx="100" cy="100" r="100" /><circle cx="100" cy="100" r="60" fill="#1a1a1a" />`,
    width: 200,
    height: 200,
    fill: "#16A085",
  },
  {
    id: "star-6",
    name: "六角星",
    svgContent: `<polygon points="100,0 130,60 200,40 160,100 200,160 130,140 100,200 70,140 0,160 40,100 0,40 70,60" />`,
    width: 200,
    height: 200,
    fill: "#D4AC0D",
  },
  {
    id: "semicircle",
    name: "半圆",
    svgContent: `<path d="M0,100 A100,100 0 0,1 200,100 L0,100Z" />`,
    width: 200,
    height: 100,
    fill: "#5DADE2",
  },
  {
    id: "crescent",
    name: "月牙",
    svgContent: `<path d="M50,10 A95,95 0 1,1 50,190 A65,65 0 0,0 50,10Z" />`,
    width: 200,
    height: 200,
    fill: "#F7DC6F",
  },
  {
    id: "lightning",
    name: "闪电",
    svgContent: `<polygon points="110,0 40,110 90,110 70,200 160,80 105,80 130,0" />`,
    width: 200,
    height: 200,
    fill: "#F39C12",
  },
  {
    id: "speech-bubble",
    name: "对话框",
    svgContent: `<path d="M20,0 L180,0 Q200,0 200,20 L200,120 Q200,140 180,140 L80,140 L40,180 L50,140 L20,140 Q0,140 0,120 L0,20 Q0,0 20,0Z" />`,
    width: 200,
    height: 180,
    fill: "#85C1E9",
  },
  {
    id: "ribbon",
    name: "横幅",
    svgContent: `<polygon points="0,20 20,0 20,60 0,40 0,20" /><rect x="20" y="10" width="160" height="40" rx="0" /><polygon points="200,20 180,0 180,60 200,40 200,20" />`,
    width: 200,
    height: 60,
    fill: "#E74C3C",
  },
];

/** 表情符号列表 */
const emojis = [
  // 笑脸 & 表情
  "😀", "😃", "😄", "😁", "😆", "😅", "🤣", "😂",
  "🙂", "😊", "😇", "🥰", "😍", "🤩", "😘", "😗",
  "😋", "😛", "😜", "🤪", "😝", "🤑", "🤗", "🤭",
  "🤫", "🤔", "🤐", "🤨", "😐", "😑", "😶", "😏",
  "😒", "🙄", "😬", "🤥", "😌", "😔", "😪", "🤤",
  "😴", "😷", "🤒", "🤕", "🤢", "🤮", "🥵", "🥶",
  "🥴", "😵", "🤯", "🤠", "🥳", "🥸", "😎", "🤓",
  "😈", "👿", "👹", "👺", "💀", "☠️", "👻", "👽",
  "🤖", "💩", "😺", "😸", "😹", "😻", "😼", "😽",
  "🙀", "😿", "😾", "🥺", "😤", "😭", "😱", "😰",
  // 手势
  "👍", "👎", "👊", "✊", "🤛", "🤜", "👏", "🙌",
  "🤝", "👐", "🤲", "🙏", "✌️", "🤞", "🤟", "🤘",
  "🤙", "💪", "👋", "🖐️", "✋", "👆", "👇", "👈",
  "👉", "☝️", "🫵", "🫶", "🫰", "🫳", "🫴", "🤌",
  // 爱心 & 符号
  "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍",
  "🤎", "💔", "❤️‍🔥", "💕", "💞", "💓", "💗", "💖",
  "💘", "💝", "💟", "❣️", "💯", "💢", "💥", "💫",
  "💦", "💨", "🔥", "⭐", "🌟", "✨", "⚡", "🎵",
  // 动物
  "🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼",
  "🐨", "🐯", "🦁", "🐮", "🐷", "🐸", "🐵", "🐔",
  "🐧", "🐦", "🐤", "🦄", "🐝", "🐛", "🦋", "🐌",
  "🐙", "🦑", "🦀", "🐠", "🐬", "🐳", "🦈", "🐊",
  // 食物 & 饮品
  "🍎", "🍊", "🍋", "🍌", "🍉", "🍇", "🍓", "🫐",
  "🍑", "🥝", "🍅", "🥑", "🍕", "🍔", "🍟", "🌭",
  "🍿", "🧀", "🥚", "🍳", "🥞", "🍩", "🍪", "🎂",
  "🍰", "🧁", "🍫", "🍬", "🍭", "🍦", "☕", "🍵",
  // 自然 & 天气
  "🌸", "🌺", "🌻", "🌹", "🌷", "🌼", "🍀", "🌿",
  "🍁", "🍂", "🌴", "🌵", "🌈", "☀️", "🌙", "⛅",
  // 物品 & 活动
  "🎉", "🎊", "🎈", "🎁", "🎀", "🏆", "🥇", "🏅",
  "🎯", "🎮", "🎲", "🧩", "🎭", "🎨", "🎬", "🎤",
  "🎧", "🎸", "🎹", "🎺", "🎻", "🥁", "📷", "📱",
  "💻", "⌨️", "🖥️", "📺", "🔑", "💡", "📌", "🔔",
  // 交通 & 旅行
  "🚀", "✈️", "🚁", "🚂", "🚗", "🚕", "🚌", "🏎️",
  "🛸", "⛵", "🚢", "🏠", "🏰", "🗼", "🗽", "⛩️",
];

/** 分类定义 */
const categories = [
  { id: "shapes", label: "形状" },
  { id: "stickers", label: "贴纸" },
  { id: "emojis", label: "表情符号" },
  { id: "gifs", label: "GIF 动图" },
] as const;

/**
 * 将形状定义转为 SVG data URL（用于添加到画布）
 */
const shapeToDataUrl = (shape: ShapeDefinition): string => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${shape.width} ${shape.height}" width="${shape.width}" height="${shape.height}"><g fill="${shape.fill}">${shape.svgContent}</g></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};

/**
 * 生成形状的预览 SVG（用于面板展示）
 */
const shapeToPreviewSvg = (shape: ShapeDefinition): string => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${shape.width} ${shape.height}"><g fill="${shape.fill}">${shape.svgContent}</g></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};

/** emoji 尺寸常量 */
const EMOJI_SIZE = 160;

/**
 * 将 emoji 转为 SVG data URL（用于添加到画布）
 */
const emojiToDataUrl = (emoji: string): string => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${EMOJI_SIZE} ${EMOJI_SIZE}" width="${EMOJI_SIZE}" height="${EMOJI_SIZE}"><text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" font-size="${EMOJI_SIZE * 0.8}">${emoji}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};

export function ElementsPanel() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const addShapeClip = useProjectStore((s) => s.addShapeClip);

  const handleShapeClick = (shape: ShapeDefinition) => {
    const dataUrl = shapeToDataUrl(shape);
    addShapeClip(
      dataUrl,
      { width: shape.width, height: shape.height },
      shape.name,
    );
  };

  const handleEmojiClick = (emoji: string) => {
    const dataUrl = emojiToDataUrl(emoji);
    addShapeClip(
      dataUrl,
      { width: EMOJI_SIZE, height: EMOJI_SIZE },
      emoji,
    );
  };

  const handleBack = () => {
    setSelectedCategory(null);
  };

  return (
    <div className="elements-panel">
      <div className="elements-panel__content">
        {selectedCategory ? (
          <>
            {/* 详细视图头部：返回按钮 + 分类标题 */}
            <div className="elements-panel__header">
              <button className="elements-panel__back-btn" onClick={handleBack} type="button">
                <ArrowLeft size={20} />
              </button>
              <h3 className="elements-panel__category-title">
                {categories.find((c) => c.id === selectedCategory)?.label}
              </h3>
            </div>

            <div className="elements-panel__scrollable">
              {/* 形状分类：网格展示，点击添加到画布 */}
              {selectedCategory === "shapes" && (
                <div className="elements-panel__grid">
                  {shapes.map((shape) => (
                    <button
                      key={shape.id}
                      className="elements-panel__item"
                      onClick={() => handleShapeClick(shape)}
                      title={shape.name}
                      type="button"
                    >
                      <img
                        className="elements-panel__shape-preview"
                        src={shapeToPreviewSvg(shape)}
                        alt={shape.name}
                        draggable={false}
                      />
                    </button>
                  ))}
                </div>
              )}

              {/* 表情符号分类：点击添加到画布 */}
              {selectedCategory === "emojis" && (
                <div className="elements-panel__grid">
                  {emojis.map((emoji, i) => (
                    <button
                      key={i}
                      className="elements-panel__item"
                      onClick={() => handleEmojiClick(emoji)}
                      title={emoji}
                      type="button"
                    >
                      <span className="elements-panel__emoji">{emoji}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* 贴纸 / GIF 占位 */}
              {(selectedCategory === "stickers" || selectedCategory === "gifs") && (
                <div className="elements-panel__placeholder">
                  即将推出，敬请期待
                </div>
              )}
            </div>
          </>
        ) : (
          /* 分类列表视图：每个分类显示标题 + 预览行 */
          <div className="elements-panel__scrollable">
            {categories.map((category) => (
              <div key={category.id} className="elements-panel__category-section">
                <div
                  className="elements-panel__category-header"
                  onClick={() => setSelectedCategory(category.id)}
                >
                  <span className="elements-panel__category-label">
                    {category.label}
                  </span>
                  <ChevronRight
                    size={16}
                    className="elements-panel__category-arrow"
                  />
                </div>
                <div className="elements-panel__category-preview">
                  {/* 形状预览：取前 5 个 */}
                  {category.id === "shapes" &&
                    shapes.slice(0, 5).map((shape) => (
                      <button
                        key={shape.id}
                        className="elements-panel__preview-item"
                        onClick={() => handleShapeClick(shape)}
                        title={shape.name}
                        type="button"
                      >
                        <img
                          className="elements-panel__shape-preview"
                          src={shapeToPreviewSvg(shape)}
                          alt={shape.name}
                          draggable={false}
                        />
                      </button>
                    ))}
                  {/* 表情预览：取前 5 个，点击添加到画布 */}
                  {category.id === "emojis" &&
                    emojis.slice(0, 5).map((emoji, i) => (
                      <button
                        key={i}
                        className="elements-panel__preview-item"
                        onClick={() => handleEmojiClick(emoji)}
                        title={emoji}
                        type="button"
                      >
                        <span className="elements-panel__emoji">{emoji}</span>
                      </button>
                    ))}
                  {/* 贴纸 / GIF 预览占位 */}
                  {(category.id === "stickers" || category.id === "gifs") &&
                    Array.from({ length: 5 }, (_, i) => (
                      <div key={i} className="elements-panel__preview-item">
                        <div className="elements-panel__preview-placeholder" />
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
