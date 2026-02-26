/**
 * 选中元素时跟随显示的 Toolbar（精简版）
 *
 * 仅包含复制和删除按钮，适用于所有类型的元素。
 * 位置由 useSelectionToolbarPosition 通过 ref 直接更新 DOM，与 Konva 同帧。
 * 属性编辑功能（文本格式、变换、音量、不透明度等）已移至顶部 SelectionToolbarFixed。
 */
import { forwardRef } from "react";
import { Toolbar } from "radix-ui";
import { Sparkles, CopyPlus, Trash2, Ellipsis } from "lucide-react";
import { TipButton } from "./ToolbarTooltip";
import { SELECTION_TOOLBAR_GAP } from "./constants";
import type { ToolbarPosition } from "./useSelectionToolbarPosition";
import "./SelectionToolbar.css";

type SelectionToolbarProps = {
  /** 是否有元素被选中 */
  visible: boolean;
  /** 选中元素的 clipId */
  clipId?: string | null;
  /** 选中元素的类型 */
  clipKind?: string | null;
  /** 跟随元素的定位坐标（由 hook 直接更新 DOM，此处用于首帧兜底） */
  position?: ToolbarPosition;
  /** 创建选中 clip 的副本 */
  onDuplicateClip?: (clipId: string) => void;
  /** 删除选中的 clip */
  onDeleteClip?: (clipId: string) => void;
};

const BTN_CLS = "selection-toolbar__btn";

export const SelectionToolbar = forwardRef<
  HTMLDivElement,
  SelectionToolbarProps
>(function SelectionToolbar(
  { visible, clipId, clipKind, position, onDuplicateClip, onDeleteClip },
  ref
) {
  if (!visible || !clipId) {
    return null;
  }

  const style: React.CSSProperties =
    position != null
      ? {
          left: position.x,
          top: position.elementTop - SELECTION_TOOLBAR_GAP,
          transform: "translate(-50%, -100%)",
        }
      : { visibility: "hidden" as const };

  return (
    <div ref={ref} className="selection-toolbar-wrapper" style={style}>
      <Toolbar.Root className="selection-toolbar" aria-label="元素操作">
        {clipKind === "text" ? (
          <TipButton label="AI 写作" className={BTN_CLS}>
            <Sparkles size={16} />
          </TipButton>
        ) : null}
        {onDuplicateClip ? (
          <TipButton
            label="创建副本"
            className={BTN_CLS}
            onClick={() => onDuplicateClip(clipId)}
          >
            <CopyPlus size={16} />
          </TipButton>
        ) : null}
        {onDeleteClip ? (
          <TipButton
            label="删除"
            className={BTN_CLS}
            onClick={() => onDeleteClip(clipId)}
          >
            <Trash2 size={16} />
          </TipButton>
        ) : null}
        <TipButton label="更多" className={BTN_CLS}>
          <Ellipsis size={16} />
        </TipButton>
      </Toolbar.Root>
    </div>
  );
});
