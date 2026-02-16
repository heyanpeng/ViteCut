import { useState, useEffect } from "react";
import "./TextPanel.css";
import { useProjectStore } from "@/stores";
import { findClipById } from "@vitecut/project";

// 定义文本样式的类型
type TextStyle = {
  // 样式名称（展示给用户）
  label: string;
  // 样式唯一值（内部处理用）
  value: string;
  // 额外的行内样式（可选）
  style?: React.CSSProperties;
};

// 支持的文本样式列表
const textStyles: TextStyle[] = [
  { label: "常规", value: "regular" }, // 正常样式
  { label: "手写", value: "handwrite", style: { fontStyle: "italic" } }, // 手写体
  { label: "斜体", value: "italic", style: { fontStyle: "italic" } }, // 斜体
  {
    label: "下划线",
    value: "underline",
    style: { textDecoration: "underline" }, // 下划线
  },
  {
    label: "全大写",
    value: "uppercase",
    style: { textTransform: "uppercase" }, // 全大写
  },
  { label: "圆润", value: "rounded" }, // 圆润字体
  {
    label: "黑底白字",
    value: "black",
    style: { backgroundColor: "#000000", color: "#ffffff" }, // 黑底白字
  },
  {
    label: "白底黑字",
    value: "white",
    style: { backgroundColor: "#ffffff", color: "#000000" }, // 白底黑字
  },
  { label: "经典", value: "classic" }, // 经典样式
  {
    label: "梗图文字",
    value: "meme",
    style: { textTransform: "uppercase", fontWeight: "bold" }, // 梗图常用的大写粗体
  },
  {
    label: "疏 字 距",
    value: "spacing",
    style: { letterSpacing: "0.05em" }, // 字间距较大
  },
  {
    label: "紧密",
    value: "strict",
    style: {
      textTransform: "uppercase",
      fontWeight: "bold",
      letterSpacing: "-0.05em",
    }, // 紧密粗体大写
  },
  { label: "手稿", value: "manuscript", style: { fontStyle: "italic" } }, // 手稿体
  { label: "欢快", value: "cheerful", style: { fontStyle: "italic" } }, // 欢快斜体
];

// 文本面板组件
export function TextPanel() {
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);
  const project = useProjectStore((s) => s.project);
  const selectedClipId = useProjectStore((s) => s.selectedClipId);
  const addTextClip = useProjectStore((s) => s.addTextClip);
  const updateClipParams = useProjectStore((s) => s.updateClipParams);

  const selectedTextClip =
    project && selectedClipId
      ? findClipById(
          project,
          selectedClipId as import("@vitecut/project").Clip["id"],
        )
      : null;
  const isTextClip = selectedTextClip?.kind === "text";
  const storedText = ((): string => {
    if (!isTextClip || !selectedTextClip) return "";
    const p = (selectedTextClip.params as { text?: string } | undefined)?.text;
    if (p != null) return p;
    const asset = project?.assets.find(
      (a) => a.id === selectedTextClip.assetId,
    );
    return asset?.textMeta?.initialText ?? "";
  })();

  const [editText, setEditText] = useState<string>(storedText);
  useEffect(() => {
    setEditText(storedText);
  }, [storedText, selectedClipId]);

  const handleTextBlur = () => {
    if (isTextClip && selectedClipId && editText !== storedText) {
      updateClipParams(selectedClipId, { text: editText });
    }
  };

  return (
    <div className="text-panel">
      <div className="text-panel__content">
        {/* 标题文字按钮 */}
        <button
          type="button"
          className="text-panel__title-button"
          onClick={() => addTextClip("标题文字")}
        >
          标题文字
        </button>

        {/* 选中文字时的编辑区 */}
        {isTextClip && (
          <div className="text-panel__edit">
            <label className="text-panel__edit-label">编辑文字</label>
            <textarea
              className="text-panel__edit-input"
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onBlur={handleTextBlur}
              rows={3}
              placeholder="输入文字内容"
            />
          </div>
        )}

        {/* 文本样式网格，每个按钮代表一个样式，点击后选中 */}
        <div className="text-panel__grid">
          {/*
						遍历文本样式数组，为每种样式渲染一个按钮。
						若和当前选中样式一致，则高亮显示。
					*/}
          {textStyles.map((style) => (
            <button
              key={style.value}
              className={`text-panel__style-button ${
                selectedStyle === style.value
                  ? "text-panel__style-button--selected"
                  : ""
              }`}
              style={style.style}
              onClick={() => {
                // 点击时设置选中样式
                setSelectedStyle(style.value);
              }}
            >
              {style.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
