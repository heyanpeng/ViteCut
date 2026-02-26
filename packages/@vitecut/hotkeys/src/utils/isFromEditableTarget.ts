/**
 * 判断事件是否来自可编辑输入区域。
 * 用于统一避免全局快捷键在输入框、文本域、下拉框或 contentEditable 中误触。
 */
export function isFromEditableTarget(event: KeyboardEvent): boolean {
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
