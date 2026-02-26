import { ALL_FORMATS, BlobSource, Input, UrlSource } from "mediabunny";
import type { MediaSource } from "./types";

/**
 * 从 URL 创建 mediabunny 的 Input 实例。
 *
 * 仅封装 source/formats，其他行为保持 mediabunny 默认。
 */
export function createInputFromUrl(url: string): Input {
  return new Input({
    source: new UrlSource(url),
    formats: ALL_FORMATS,
  });
}

/**
 * 从 Blob/File 创建 mediabunny 的 Input 实例。
 */
export function createInputFromBlob(blob: Blob): Input {
  return new Input({
    source: new BlobSource(blob),
    formats: ALL_FORMATS,
  });
}

/**
 * 从统一的 MediaSource 创建 Input。
 */
export function createInputFromSource(source: MediaSource): Input {
  if (source.type === "url") {
    return createInputFromUrl(source.url);
  }
  return createInputFromBlob(source.blob);
}
