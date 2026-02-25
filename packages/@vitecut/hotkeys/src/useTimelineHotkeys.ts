import { useEffect } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import type { UseTimelineHotkeysOptions } from "./index";
import { isFromEditableTarget } from "./utils/isFromEditableTarget";

export function useTimelineHotkeys(options: UseTimelineHotkeysOptions): void {
  /**
   * options 里只描述“能做什么”，具体快捷键组合在本 hook 内部统一约定。
   * enabled 为 false 时所有时间轴级快捷键整体失效。
   */
  const {
    enabled = true,
    onCopyClip,
    onPasteClip,
    onDeleteClip,
    onCutClip,
    onTogglePlay,
    onUndo,
    onRedo,
    onZoomIn,
    onZoomOut,
    onZoomFit,
  } = options;

  // 播放/暂停：Space
  useHotkeys(
    "space",
    (event) => {
      if (!enabled || !onTogglePlay) {
        return;
      }
      if (isFromEditableTarget(event)) {
        return;
      }
      event.preventDefault();
      onTogglePlay();
    },
    { enableOnFormTags: ["INPUT", "TEXTAREA", "SELECT"] },
    [enabled, onTogglePlay],
  );

  // 复制 clip：Cmd/Ctrl + C
  useHotkeys(
    "mod+c",
    (event) => {
      if (!enabled || !onCopyClip) {
        return;
      }
      if (isFromEditableTarget(event)) {
        return;
      }
      event.preventDefault();
      onCopyClip();
    },
    { enableOnFormTags: ["INPUT", "TEXTAREA", "SELECT"] },
    [enabled, onCopyClip],
  );

  // 粘贴 clip：Cmd/Ctrl + V
  useHotkeys(
    "mod+v",
    (event) => {
      if (!enabled || !onPasteClip) {
        return;
      }
      if (isFromEditableTarget(event)) {
        return;
      }
      event.preventDefault();
      onPasteClip();
    },
    { enableOnFormTags: ["INPUT", "TEXTAREA", "SELECT"] },
    [enabled, onPasteClip],
  );

  // 切断 clip（在播放头处）：Cmd/Ctrl + X
  useHotkeys(
    "mod+x",
    (event) => {
      if (!enabled || !onCutClip) {
        return;
      }
      if (isFromEditableTarget(event)) {
        return;
      }
      event.preventDefault();
      onCutClip();
    },
    { enableOnFormTags: ["INPUT", "TEXTAREA", "SELECT"] },
    [enabled, onCutClip],
  );

  // 删除 clip：Delete / Backspace
  useHotkeys(
    ["delete", "backspace"],
    (event) => {
      if (!enabled || !onDeleteClip) {
        return;
      }
      if (isFromEditableTarget(event)) {
        return;
      }
      event.preventDefault();
      onDeleteClip();
    },
    { enableOnFormTags: ["INPUT", "TEXTAREA", "SELECT"] },
    [enabled, onDeleteClip],
  );

  // 撤销：Cmd/Ctrl + Z
  useHotkeys(
    "mod+z",
    (event) => {
      if (!enabled || !onUndo) {
        return;
      }
      if (isFromEditableTarget(event)) {
        return;
      }
      event.preventDefault();
      onUndo();
    },
    { enableOnFormTags: ["INPUT", "TEXTAREA", "SELECT"] },
    [enabled, onUndo],
  );

  // 重做：Cmd/Ctrl + Shift + Z，或 Cmd/Ctrl + Y 等常见变体
  useHotkeys(
    ["mod+shift+z", "mod+y", "ctrl+shift+z", "ctrl+y"],
    (event) => {
      if (!enabled || !onRedo) {
        return;
      }
      if (isFromEditableTarget(event)) {
        return;
      }
      event.preventDefault();
      onRedo();
    },
    { enableOnFormTags: ["INPUT", "TEXTAREA", "SELECT"] },
    [enabled, onRedo],
  );

  /**
   * 时间轴缩放快捷键（使用 Cmd/Ctrl + +/-/0），并在 capture 阶段拦截浏览器默认缩放。
   *
   * - 放大：Cmd/Ctrl + +
   * - 缩小：Cmd/Ctrl + -
   * - 适应视图：Cmd/Ctrl + 0
   *
   * 说明：
   * - 直接用浏览器默认快捷键容易触发页面缩放，这里通过 window keydown capture + preventDefault 拦截。
   * - 仍然遵守 enabled 和「来源于可编辑输入区域」这两层过滤。
   */
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDownCapture = (event: KeyboardEvent) => {
      const isMod = event.metaKey || event.ctrlKey;
      if (!isMod) return;
      if (isFromEditableTarget(event)) return;

      const key = event.key;

      if ((key === "+" || key === "=") && onZoomIn) {
        event.preventDefault();
        event.stopPropagation();
        onZoomIn();
        return;
      }

      if (key === "-" && onZoomOut) {
        event.preventDefault();
        event.stopPropagation();
        onZoomOut();
        return;
      }

      if (key === "0" && onZoomFit) {
        event.preventDefault();
        event.stopPropagation();
        onZoomFit();
      }
    };

    // 使用 capture 阶段，尽可能在浏览器默认处理前拦截
    window.addEventListener("keydown", handleKeyDownCapture, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDownCapture, true);
    };
  }, [enabled, onZoomIn, onZoomOut, onZoomFit]);
}
