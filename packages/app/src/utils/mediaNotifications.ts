import type { MediaRecord } from "@/api/mediaApi";

export function notifyMediaRefresh(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("vitecut-media-refresh"));
  }
}

/** 上传完成时通知媒体面板追加新记录，避免整页刷新 */
export function notifyMediaAdded(record: MediaRecord): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("vitecut-media-added", { detail: { record } })
    );
  }
}
