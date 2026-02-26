import { useHotkeys } from "react-hotkeys-hook";
import type { UsePreviewHotkeysOptions } from "./index";
import { isFromEditableTarget } from "./utils/isFromEditableTarget";

/**
 * 注册方向键相关快捷键（含 shift 组合）。
 *
 * 支持的组合：
 * - 上下左右方向键
 * - Shift+方向键
 *
 * 约束与行为说明：
 * - 仅当 enabled 为 true 且设置了 onMoveByArrow 时生效。
 * - 可编辑输入区域不会触发。
 * - 回调函数提供方向、是否按下 shift 以及原始事件对象。
 */
export function usePreviewHotkeys(options: UsePreviewHotkeysOptions): void {
  const { enabled = true, onMoveByArrow } = options;

  useHotkeys(
    [
      "up",
      "down",
      "left",
      "right",
      "shift+up",
      "shift+down",
      "shift+left",
      "shift+right",
    ],
    (event) => {
      // 若未启用或未提供回调则不处理
      if (!enabled || !onMoveByArrow) {
        return;
      }
      // 来源于输入控件时不处理
      if (isFromEditableTarget(event)) {
        return;
      }

      const key = event.key;
      let direction: "up" | "down" | "left" | "right" | null = null;
      if (key === "ArrowUp") direction = "up";
      else if (key === "ArrowDown") direction = "down";
      else if (key === "ArrowLeft") direction = "left";
      else if (key === "ArrowRight") direction = "right";

      // 非方向键则忽略
      if (!direction) return;

      // 触发回调，包含方向、shift 状态和原事件
      onMoveByArrow({
        direction,
        isShift: event.shiftKey,
        event,
      });
    },
    // 允许在这些表单标签上生效，但内部已判定不触发
    { enableOnFormTags: ["INPUT", "TEXTAREA", "SELECT"] },
    [enabled, onMoveByArrow]
  );
}
