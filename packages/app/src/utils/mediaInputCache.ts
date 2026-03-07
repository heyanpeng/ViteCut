import { createInputFromUrl } from "@vitecut/media";
import type { Input } from "mediabunny";

/**
 * URL -> Input 共享缓存。
 *
 * 说明：
 * - 预览解码与时间轴缩略图会并发读取同一视频 URL。
 * - 通过复用同一个 Input，尽量减少重复的网络读取与容器解析开销。
 */
const inputByUrl = new Map<string, Input>();

/**
 * 获取可复用的媒体 Input（按 URL 复用）。
 */
export function getSharedMediaInput(url: string): Input {
  const existing = inputByUrl.get(url);
  if (existing) {
    return existing;
  }
  const input = createInputFromUrl(url);
  inputByUrl.set(url, input);
  return input;
}

/**
 * 清理不再需要的 URL Input 缓存（可选调用）。
 */
export function clearSharedMediaInput(url: string): void {
  inputByUrl.delete(url);
}

