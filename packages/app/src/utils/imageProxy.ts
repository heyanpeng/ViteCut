/**
 * 图片缩略图代理服务地址。
 */
const IMGPROXY_BASE_URL = "https://imgproxy.vitecut.com";
/** 高倍屏缩放上限，兼顾清晰度与缩略图加载速度。 */
const MAX_DEVICE_PIXEL_RATIO = 2;

/**
 * 从 OSS URL 推断 s3://bucket/key 路径。
 * 目前媒体接口返回值形如：
 * https://oss.vitecut.com/vitecut/user/2026/03/03/xxx.jpg?X-Amz-...
 */
function toS3PathFromMediaUrl(source: string): string | null {
  if (!source) {
    return null;
  }
  if (source.startsWith("s3://")) {
    return source;
  }
  if (source.startsWith("blob:") || source.startsWith("data:")) {
    return null;
  }
  try {
    const url = new URL(source);
    const host = url.hostname.toLowerCase();
    // 当前只处理我们 OSS 场景，避免误改第三方 URL。
    if (!host.endsWith("oss.vitecut.com")) {
      return null;
    }
    const path = decodeURIComponent(url.pathname).replace(/^\/+/, "");
    if (!path) {
      return null;
    }
    const segments = path.split("/").filter(Boolean);
    if (segments.length < 2) {
      return null;
    }
    const [bucket, ...key] = segments;
    if (!bucket || key.length === 0) {
      return null;
    }
    return `s3://${bucket}/${key.join("/")}`;
  } catch {
    return null;
  }
}

function toTargetPixels(
  value: number | undefined,
  useDevicePixelRatio: boolean
): number | null {
  if (!value || !Number.isFinite(value) || value <= 0) {
    return null;
  }
  const dpr =
    useDevicePixelRatio && typeof window !== "undefined"
      ? Math.min(MAX_DEVICE_PIXEL_RATIO, window.devicePixelRatio || 1)
      : 1;
  const scaled = Math.round(value * dpr);
  return Math.max(1, Math.min(4096, scaled));
}

export interface ImageProxySizeOptions {
  width?: number;
  height?: number;
  /**
   * 默认 fill；列表图可使用 fit 保持内容完整。
   */
  mode?: "fill" | "fit";
  /**
   * 是否考虑 devicePixelRatio，默认 true，保证高清屏不糊。
   */
  useDevicePixelRatio?: boolean;
}

/**
 * 生成 imgproxy 缩略图 URL。
 * - 无法转换为 s3 路径时，回退原始 URL
 * - 未提供尺寸时，回退原始 URL
 */
export function getImageProxyUrl(
  source: string,
  options: ImageProxySizeOptions = {}
): string {
  const s3Path = toS3PathFromMediaUrl(source);
  if (!s3Path) {
    return source;
  }
  const mode = options.mode ?? "fill";
  const useDevicePixelRatio = options.useDevicePixelRatio ?? true;
  const width = toTargetPixels(options.width, useDevicePixelRatio);
  const height = toTargetPixels(options.height, useDevicePixelRatio);
  if (!width && !height) {
    return source;
  }
  // 与现有服务保持一致：
  // - 仅宽度：rs:fill:300
  // - 宽高同时：rs:fill:300:200
  // - 仅高度：rs:fit:0:80（0 表示按比例自动计算宽度）
  const resizeSegment =
    width && height
      ? `rs:${mode}:${width}:${height}`
      : width
        ? `rs:${mode}:${width}`
        : `rs:${mode}:0:${height}`;
  return `${IMGPROXY_BASE_URL}/unsafe/${resizeSegment}/plain/${encodeURI(s3Path)}`;
}
