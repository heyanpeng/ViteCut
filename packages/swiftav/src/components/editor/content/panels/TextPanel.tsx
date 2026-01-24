import { useState } from "react";
import "./TextPanel.css";

type TextStyle = {
  label: string;
  value: string;
  style?: React.CSSProperties;
};

const textStyles: TextStyle[] = [
  { label: "Regular text", value: "regular" },
  { label: "Hand Write", value: "handwrite", style: { fontStyle: "italic" } },
  { label: "Italic Text", value: "italic", style: { fontStyle: "italic" } },
  {
    label: "Underline",
    value: "underline",
    style: { textDecoration: "underline" },
  },
  {
    label: "UPPERCASE",
    value: "uppercase",
    style: { textTransform: "uppercase" },
  },
  { label: "Rounded", value: "rounded" },
  {
    label: "BLACK",
    value: "black",
    style: { backgroundColor: "#000000", color: "#ffffff" },
  },
  {
    label: "WHITE",
    value: "white",
    style: { backgroundColor: "#ffffff", color: "#000000" },
  },
  { label: "Classic", value: "classic" },
  {
    label: "MEME TEXT",
    value: "meme",
    style: { textTransform: "uppercase", fontWeight: "bold" },
  },
  {
    label: "S p a c i n g",
    value: "spacing",
    style: { letterSpacing: "0.05em" },
  },
  {
    label: "STRICT",
    value: "strict",
    style: {
      textTransform: "uppercase",
      fontWeight: "bold",
      letterSpacing: "-0.05em",
    },
  },
  { label: "Manuscript", value: "manuscript", style: { fontStyle: "italic" } },
  { label: "Cheerful", value: "cheerful", style: { fontStyle: "italic" } },
];

export function TextPanel() {
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);

  return (
    <div className="text-panel">
      <div className="text-panel__content">
        {/* Title text 按钮 */}
        <button className="text-panel__title-button">Title text</button>

        {/* 文本样式网格 */}
        <div className="text-panel__grid">
          {textStyles.map((style) => (
            <button
              key={style.value}
              className={`text-panel__style-button ${
                selectedStyle === style.value
                  ? "text-panel__style-button--selected"
                  : ""
              }`}
              style={style.style}
              onClick={() => setSelectedStyle(style.value)}
            >
              {style.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
