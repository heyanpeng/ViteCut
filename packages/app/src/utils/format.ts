/**
 * 格式化工具函数
 */

/**
 * 格式化时长（秒）为 MM:SS 格式
 * @param seconds 秒数
 * @returns 格式化的时长字符串，如 "3:45"
 */
export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * 格式化时间戳为日期时间字符串
 * @param ts 时间戳（毫秒）
 * @returns 格式化的日期时间字符串，如 "2026-03-01 14:30"
 */
export function formatAddedAt(ts: number): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day} ${hh}:${mm}`;
}
