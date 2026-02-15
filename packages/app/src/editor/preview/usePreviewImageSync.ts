import { useEffect, useRef, type RefObject } from "react";
import type { CanvasEditor } from "@swiftav/canvas";
import type { Project } from "@swiftav/project";
import { playbackClock } from "./playbackClock";

const IMAGE_CACHE_MAX_SIZE = 100;

/**
 * 图片缓存池，按 source URL 存储已加载的 HTMLImageElement，
 * 用于避免同一图片资源被重复加载，提高性能，减少网络请求。
 * 缓存有大小上限，超出时淘汰最早加入的项，避免内存泄漏。
 */
const imageCache = new Map<string, HTMLImageElement>();

/**
 * 加载图片的工具函数。会先从 imageCache 尝试取缓存，如果没有则异步加载
 * @param source 图片资源 URL
 * @returns Promise<HTMLImageElement>
 */
function loadImage(source: string): Promise<HTMLImageElement> {
  const cached = imageCache.get(source);
  if (cached) {
    return Promise.resolve(cached);
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (imageCache.size >= IMAGE_CACHE_MAX_SIZE) {
        const firstKey = imageCache.keys().next().value;
        if (firstKey !== undefined) {
          imageCache.delete(firstKey);
        }
      }
      imageCache.set(source, img);
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
 * 播放时从 playbackClock 读取时间，暂停时用 store.currentTime。
 *
 * @param editorRef 画布编辑器实例（RefObject）
 * @param project 项目数据对象，包含所有 track/clip/asset
 * @param currentTime 当前时间线位置（秒）
 * @param isPlaying 是否正在播放
 */
export function usePreviewImageSync(
  editorRef: RefObject<CanvasEditor | null>,
  project: Project | null,
  currentTime: number,
  isPlaying: boolean,
): void {
  // 已同步到画布的图片 clip id 集合，避免重复 add/remove
  const syncedImageClipIdsRef = useRef<Set<string>>(new Set());
  /**
   * 当前帧可见图片 clip 的 id 集合，供异步 loadImage 后校验，
   * 如果图片异步加载完成时，其 id 已不在可见集，则不应再添加到画布
   */
  const visibleImageIdsRef = useRef<Set<string>>(new Set());

  const syncImageForTime = (t: number) => {
    const editor = editorRef.current;
    if (!editor || !project) return;
    const stageSize = editor.getStage().size();
    const stageW = Math.max(1, Math.round(stageSize.width));
    const stageH = Math.max(1, Math.round(stageSize.height));
    // 将工程坐标缩放到画布坐标（与 usePreviewTextSync 一致）
    const scaleToStageX = stageW / project.width;
    const scaleToStageY = stageH / project.height;

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
      rotation?: number;
      opacity?: number;
    }> = [];

    // 按轨道 order 升序遍历（order 大的后绘制，显示在上层）
    const tracksByOrder = [...project.tracks].sort((a, b) => a.order - b.order);
    for (const track of tracksByOrder) {
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
        // transform 语义：x/y 为 project 像素，scaleX/scaleY 为相对 project 比例
        const scaleX = clip.transform?.scaleX ?? 1;
        const scaleY = clip.transform?.scaleY ?? 1;
        const projX = clip.transform?.x ?? 0;
        const projY = clip.transform?.y ?? 0;
        visibleImageClips.push({
          id: clip.id,
          source: asset.source,
          x: projX * scaleToStageX,
          y: projY * scaleToStageY,
          width: stageW * scaleX,
          height: stageH * scaleY,
          rotation: clip.transform?.rotation,
          opacity: clip.transform?.opacity,
        });
      }
    }

    // 本帧所有应可见图片剪辑的 id 集合
    const visibleIds = new Set(visibleImageClips.map((c) => c.id));
    visibleImageIdsRef.current = visibleIds;

    // Step1: 先收集需移除的 id，再统一移除（避免遍历时修改 Set）
    const idsToRemove: string[] = [];
    for (const id of syncedImageClipIdsRef.current) {
      if (!visibleIds.has(id)) {
        idsToRemove.push(id);
      }
    }
    for (const id of idsToRemove) {
      editor.removeImage(id);
      syncedImageClipIdsRef.current.delete(id);
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
          rotation: clip.rotation,
          opacity: clip.opacity,
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
              rotation: clip.rotation,
              opacity: clip.opacity,
            });
            // 标记已同步
            syncedImageClipIdsRef.current.add(clip.id);
            // 请求批量渲染，保证尽快在舞台上显示
            editorRef.current.getStage().batchDraw();
          })
          .catch((err) => {
            console.error("图片加载失败:", clip.source, err);
          });
      }
    }
  };

  // project 卸载或切换时，清理画布上已同步的图片
  const prevProjectRef = useRef<Project | null | undefined>(undefined);
  useEffect(() => {
    const prev = prevProjectRef.current;
    prevProjectRef.current = project;
    if (prev !== undefined && prev !== project) {
      const editor = editorRef.current;
      if (editor) {
        for (const id of syncedImageClipIdsRef.current) {
          editor.removeImage(id);
        }
        syncedImageClipIdsRef.current.clear();
      }
    }
  }, [editorRef, project]);

  // 暂停时：用 store.currentTime 同步
  useEffect(() => {
    if (isPlaying || !project) return;
    const editor = editorRef.current;
    if (!editor) return;
    syncImageForTime(currentTime);
  }, [editorRef, project, currentTime, isPlaying]);

  // 播放时：rAF 循环从 playbackClock 读取时间并同步
  useEffect(() => {
    if (!isPlaying || !project) return;
    let rafId: number | null = null;
    const loop = () => {
      syncImageForTime(playbackClock.currentTime);
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
    return () => {
      if (rafId != null) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [editorRef, project, isPlaying]);
}
