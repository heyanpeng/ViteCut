/**
 * 选中元素时显示的 Toolbar
 *
 * 基于 Radix UI Toolbar，跟随选中元素位置显示，避免遮挡画布内容。
 * 位置由 useSelectionToolbarPosition 通过 ref 直接更新 DOM，与 Konva 同帧。
 */
import { forwardRef } from "react";
import type { ClipKind } from "@swiftav/project";
import { Toolbar } from "radix-ui";
import { SELECTION_TOOLBAR_GAP } from "./constants";
import type { ToolbarPosition } from "./useSelectionToolbarPosition";
import "./SelectionToolbar.css";

type SelectionToolbarProps = {
  /** 是否有元素被选中 */
  visible: boolean;
  /** 选中的 clip 类型（用于将来展示不同工具） */
  clipKind?: ClipKind;
  /** 跟随元素的定位坐标（由 hook 直接更新 DOM，此处用于首帧兜底） */
  position?: ToolbarPosition;
};

export const SelectionToolbar = forwardRef<
  HTMLDivElement,
  SelectionToolbarProps
>(function SelectionToolbar({ visible, clipKind, position }, ref) {
  if (!visible) return null;

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
      <Toolbar.Root className="selection-toolbar" aria-label="元素编辑">
        <Toolbar.Button className="selection-toolbar__btn" type="button">
          工具占位
        </Toolbar.Button>
        <Toolbar.Separator className="selection-toolbar__separator" />
        <Toolbar.Button className="selection-toolbar__btn" type="button">
          {clipKind ?? "元素"} 已选中
        </Toolbar.Button>
      </Toolbar.Root>
    </div>
  );
});
