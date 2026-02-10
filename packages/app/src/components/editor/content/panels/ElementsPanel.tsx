import { useState } from "react";
import { ArrowLeft, ChevronRight } from "lucide-react";
import "./ElementsPanel.css";

type ElementItem = {
  id: string;
  type: "shape" | "sticker" | "emoji" | "gif";
  thumbnailUrl?: string;
  emoji?: string;
  color?: string;
};

const categories = [
  { id: "shapes", label: "形状", type: "shape" as const },
  { id: "stickers", label: "贴纸", type: "sticker" as const },
  { id: "emojis", label: "表情符号", type: "emoji" as const },
  { id: "gifs", label: "GIF 动图", type: "gif" as const },
];

// 模拟数据
const mockElements: Record<string, ElementItem[]> = {
  shapes: Array.from({ length: 24 }, (_, i) => ({
    id: `shape-${i + 1}`,
    type: "shape" as const,
    color: `hsl(${(i * 15) % 360}, 70%, 50%)`,
  })),
  stickers: Array.from({ length: 20 }, (_, i) => ({
    id: `sticker-${i + 1}`,
    type: "sticker" as const,
    thumbnailUrl: ``,
  })),
  emojis: [
    "😀",
    "😂",
    "😊",
    "😍",
    "🥰",
    "😘",
    "😋",
    "😎",
    "🤔",
    "😴",
    "😭",
    "😡",
    "🤗",
    "🤩",
    "🥳",
    "😱",
    "🤢",
    "🤮",
    "🤧",
    "🤯",
  ].map((emoji, i) => ({
    id: `emoji-${i + 1}`,
    type: "emoji" as const,
    emoji,
  })),
  gifs: Array.from({ length: 20 }, (_, i) => ({
    id: `gif-${i + 1}`,
    type: "gif" as const,
    thumbnailUrl: ``,
  })),
};

export function ElementsPanel() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const handleCategoryClick = (categoryId: string) => {
    setSelectedCategory(categoryId);
  };

  const handleBack = () => {
    setSelectedCategory(null);
  };

  const currentCategory = categories.find((c) => c.id === selectedCategory);
  const currentElements = selectedCategory
    ? mockElements[selectedCategory] || []
    : [];

  return (
    <div className="elements-panel">
      <div className="elements-panel__content">
        {selectedCategory ? (
          // 分类详细视图
          <>
            <div className="elements-panel__header">
              <button className="elements-panel__back-btn" onClick={handleBack}>
                <ArrowLeft size={20} />
              </button>
              <h3 className="elements-panel__category-title">
                {currentCategory?.label}
              </h3>
            </div>
            <div className="elements-panel__scrollable">
              <div className="elements-panel__grid">
                {currentElements.map((element) => (
                  <div
                    key={element.id}
                    className="elements-panel__item"
                    onClick={() => {
                      // 处理元素选择
                      console.log("Selected element:", element);
                    }}
                  >
                    {element.type === "shape" && element.color && (
                      <div
                        className="elements-panel__shape"
                        style={{ backgroundColor: element.color }}
                      />
                    )}
                    {element.type === "emoji" && element.emoji && (
                      <div className="elements-panel__emoji">
                        {element.emoji}
                      </div>
                    )}
                    {(element.type === "sticker" || element.type === "gif") &&
                      element.thumbnailUrl && (
                        <img
                          src={element.thumbnailUrl}
                          alt={element.id}
                          className="elements-panel__thumbnail"
                        />
                      )}
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          // 分类列表视图
          <div className="elements-panel__scrollable">
            {categories.map((category) => {
              const categoryElements = mockElements[category.id] || [];
              const previewElements = categoryElements.slice(0, 5);

              return (
                <div
                  key={category.id}
                  className="elements-panel__category-section"
                >
                  <div
                    className="elements-panel__category-header"
                    onClick={() => handleCategoryClick(category.id)}
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
                    {previewElements.map((element) => (
                      <div
                        key={element.id}
                        className="elements-panel__preview-item"
                      >
                        {element.type === "shape" && element.color && (
                          <div
                            className="elements-panel__shape"
                            style={{ backgroundColor: element.color }}
                          />
                        )}
                        {element.type === "emoji" && element.emoji && (
                          <div className="elements-panel__emoji">
                            {element.emoji}
                          </div>
                        )}
                        {(element.type === "sticker" ||
                          element.type === "gif") &&
                          element.thumbnailUrl && (
                            <img
                              src={element.thumbnailUrl}
                              alt={element.id}
                              className="elements-panel__thumbnail"
                            />
                          )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
