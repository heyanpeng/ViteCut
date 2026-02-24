import { useState, useEffect } from "react";
import "./TextPanel.css";
import { useProjectStore } from "@/stores";
import { findClipById } from "@vitecut/project";

// 文本面板组件
export function TextPanel() {
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
        {/* 类似 Word 的段落预设：正文 / 标题 1-4 */}
        <div className="text-panel__presets">
          <button
            type="button"
            className="text-panel__title-button text-panel__title-button--body"
            onClick={() => addTextClip("正文", 48)}
          >
            正文
          </button>
          <button
            type="button"
            className="text-panel__title-button text-panel__title-button--h1"
            onClick={() => addTextClip("标题1", 96)}
          >
            标题1
          </button>
          <button
            type="button"
            className="text-panel__title-button text-panel__title-button--h2"
            onClick={() => addTextClip("标题2", 72)}
          >
            标题2
          </button>
          <button
            type="button"
            className="text-panel__title-button text-panel__title-button--h3"
            onClick={() => addTextClip("标题3", 60)}
          >
            标题3
          </button>
        </div>

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
      </div>
    </div>
  );
}
