import { useEffect, useRef, type RefObject } from "react";
import type { CanvasEditor } from "@swiftav/canvas";
import type { Project } from "@swiftav/project";

/**
 * 图片缓存池，按 asset.id 存储已加载的 HTMLImageElement，
 * 用于避免同一图片资源被重复加载，提高性能，减少网络请求
 */
const imageCache = new Map<string, HTMLImageElement>();

/**
 * 加载图片的工具函数。会先从 imageCache 尝试取缓存，如果没有则异步加载
 * @param source 图片资源 URL
 * @returns Promise<HTMLImageElement>
 */
function loadImage(source: string): Promise<HTMLImageElement> {
  // 优先用缓存
  const cached = imageCache.get(source);
  if (cached) {
    return Promise.resolve(cached);
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous"; // 允许跨域加载图片，解决画布污染问题
    img.onload = () => {
      imageCache.set(source, img); // 加入缓存，后续可复用
      resolve(img);
    };
    img.onerror = reject;
    img.src = source;
  });
}

/**
 * 基于 currentTime 同步当前帧所有可见图片剪辑到画布
 * - 仅同步 start <= t < end 区间内的图片 clip
 * - 按 id 对比内部已同步集合，决定增/删/更新（diff）
 * - 图片资源按 asset 缓存，避免相同 asset 重复创建对象
 *
 * @param editorRef 画布编辑器实例（RefObject）
 * @param project 项目数据对象，包含所有 track/clip/asset
 * @param currentTime 当前时间线位置（秒）
 */
export function usePreviewImageSync(
  editorRef: RefObject<CanvasEditor | null>,
  project: Project | null,
  currentTime: number,
): void {
  // 已同步到画布的图片 clip id 集合，避免重复 add/remove
  const syncedImageClipIdsRef = useRef<Set<string>>(new Set());
  /**
   * 当前帧可见图片 clip 的 id 集合，供异步 loadImage 后校验，
   * 如果图片异步加载完成时，其 id 已不在可见集，则不应再添加到画布
   */
  const visibleImageIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) {
      // 画布未初始化无需处理
      return;
    }
    if (!project) {
      // 项目被卸载或未加载，移除所有已同步图片
      for (const id of syncedImageClipIdsRef.current) {
        editor.removeImage(id);
      }
      syncedImageClipIdsRef.current.clear();
      return;
    }

    const t = currentTime;
    const stageSize = editor.getStage().size();
    // 画布舞台宽高，最小为1，避免为0时出错
    const stageW = Math.max(1, Math.round(stageSize.width));
    const stageH = Math.max(1, Math.round(stageSize.height));

    /**
     * 收集当前在时间线 t 可见的图片 clip 信息
     * 每个clip包括它的 asset、位置和尺寸等参数
     */
    const visibleImageClips: Array<{
      id: string;
      source: string;
      x: number;
      y: number;
      width: number;
      height: number;
    }> = [];

    // 遍历所有轨道，挑出未隐藏的图片类型clip且时间线在显示区间
    for (const track of project.tracks) {
      if (track.hidden) {
        continue;
      }
      for (const clip of track.clips) {
        // 只处理 kind="image"&区间内的clip
        if (clip.kind !== "image" || clip.start > t || clip.end <= t) {
          continue;
        }
        // 找到 asset，类型必须是图片且存在有效地址
        const asset = project.assets.find((a) => a.id === clip.assetId);
        if (!asset || asset.kind !== "image" || !asset.source) {
          continue;
        }
        // 按clip.transform或默认值算位置和缩放
        const scaleX = clip.transform?.scaleX ?? 1;
        const scaleY = clip.transform?.scaleY ?? 1;
        visibleImageClips.push({
          id: clip.id,
          source: asset.source,
          x: clip.transform?.x ?? 0,
          y: clip.transform?.y ?? 0,
          width: stageW * scaleX,
          height: stageH * scaleY,
        });
      }
    }

    // 本帧所有应可见图片剪辑的 id 集合
    const visibleIds = new Set(visibleImageClips.map((c) => c.id));
    visibleImageIdsRef.current = visibleIds;

    // Step1: 先移除所有上帧存在但本帧不可见的图片
    for (const id of syncedImageClipIdsRef.current) {
      if (!visibleIds.has(id)) {
        editor.removeImage(id);
        syncedImageClipIdsRef.current.delete(id);
      }
    }

    // Step2: 增/更新本帧所有应可见图片
    for (const clip of visibleImageClips) {
      // 已同步过，直接更新位置和尺寸
      if (syncedImageClipIdsRef.current.has(clip.id)) {
        editor.updateImage(clip.id, {
          x: clip.x,
          y: clip.y,
          width: clip.width,
          height: clip.height,
        });
      } else {
        // 首次出现，需异步加载图片（带缓存）
        loadImage(clip.source)
          .then((img) => {
            // 再次判断此时画布/clip是否仍应同步，保证正确性
            if (!editorRef.current) {
              return;
            }
            if (!visibleImageIdsRef.current.has(clip.id)) {
              // 图片异步加载完时已不可见，忽略
              return;
            }
            // 加入画布
            editorRef.current.addImage(img, {
              id: clip.id,
              x: clip.x,
              y: clip.y,
              width: clip.width,
              height: clip.height,
            });
            // 标记已同步
            syncedImageClipIdsRef.current.add(clip.id);
            // 请求批量渲染，保证尽快在舞台上显示
            editorRef.current.getStage().batchDraw();
          })
          .catch(() => {
            // 忽略图片加载错误，保障主流程不受影响
          });
      }
    }
    // 依赖全部核心变量，副作用钩子根据输入变更同步
  }, [editorRef, project, currentTime]);
}
