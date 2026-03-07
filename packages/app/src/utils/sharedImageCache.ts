/**
 * 共享图片缓存：供尺寸探测、预览渲染等多处复用同一批 Image 对象，
 * 避免重复网络请求与重复解码。
 */
const IMAGE_CACHE_MAX_SIZE = 200;

/** 已完成加载的图片缓存 */
const imageCache = new Map<string, HTMLImageElement>();
/** 正在加载中的 Promise 缓存（并发去重） */
const imageLoadingPromises = new Map<string, Promise<HTMLImageElement>>();

function shouldUseAnonymousCrossOrigin(source: string): boolean {
  // imgproxy 当前未返回 ACAO，不能强制 anonymous。
  return !source.includes("imgproxy.vitecut.com");
}

function setCache(source: string, img: HTMLImageElement): void {
  if (imageCache.size >= IMAGE_CACHE_MAX_SIZE) {
    const firstKey = imageCache.keys().next().value;
    if (firstKey !== undefined) {
      imageCache.delete(firstKey);
    }
  }
  imageCache.set(source, img);
}

/**
 * 从共享缓存读取已加载图片。
 */
export function getSharedCachedImage(source: string): HTMLImageElement | undefined {
  return imageCache.get(source);
}

/**
 * 通过共享缓存加载图片：
 * - 命中缓存：同步返回
 * - 并发请求：复用同一个 Promise
 * - 首次请求：创建 Image 加载并写入缓存
 */
export function loadSharedImage(source: string): Promise<HTMLImageElement> {
  const cached = imageCache.get(source);
  if (cached) {
    return Promise.resolve(cached);
  }
  const loading = imageLoadingPromises.get(source);
  if (loading) {
    return loading;
  }

  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    if (shouldUseAnonymousCrossOrigin(source)) {
      img.crossOrigin = "anonymous";
    }
    img.onload = () => {
      setCache(source, img);
      imageLoadingPromises.delete(source);
      resolve(img);
    };
    img.onerror = (err) => {
      imageLoadingPromises.delete(source);
      reject(err instanceof Error ? err : new Error("Failed to load image"));
    };
    img.src = source;
  });

  imageLoadingPromises.set(source, promise);
  return promise;
}

