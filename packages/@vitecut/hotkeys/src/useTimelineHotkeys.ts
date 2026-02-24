import { useHotkeys } from "react-hotkeys-hook";
import type { UseTimelineHotkeysOptions } from "./index";

/**
 * 判断事件是否来自可编辑输入区域。
 * 这些区域交给浏览器/输入组件自身处理快捷键，不触发全局时间轴热键。
 */
function isFromEditableTarget(event: KeyboardEvent): boolean {
  const target = event.target as HTMLElement | null;
  if (!target) {
    return false;
  }
  const tagName = target.tagName;
  if (tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT") {
    return true;
  }
  if (target.isContentEditable) {
    return true;
  }
  return false;
}

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
}
