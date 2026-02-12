/**
 * 将秒数格式化为 "m:ss.xx" 字符串（两位小数）
 */
export const formatTime = (time: number): string => {
  const clamped = Math.max(0, time);
  const minutes = Math.floor(clamped / 60);
  const seconds = Math.floor(clamped % 60);
  const ms = Math.floor((clamped * 100) % 100); // 两位毫秒
  return `${minutes}:${seconds.toString().padStart(2, "0")}.${ms
    .toString()
    .padStart(2, "0")}`;
};

/**
 * 将秒数格式化为 "m:ss" 字符串（无小数，用于刻度等场景）
 */
export const formatTimeLabel = (time: number): string => {
  const clamped = Math.max(0, time);
  const minutes = Math.floor(clamped / 60);
  const seconds = Math.floor(clamped % 60);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

