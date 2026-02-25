import { useEffect, useRef, type RefObject } from "react";
import type { CanvasEditor } from "@vitecut/canvas";
import type { Clip } from "@vitecut/project";
import type { Project } from "@vitecut/project";
import { playbackClock } from "./playbackClock";
import { drawImageWithFiltersToCanvas } from "./usePreviewVideo.shared";

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
  resizeTick?: number,
): void {
  // 已同步到画布的图片 clip id 集合，避免重复 add/remove
  const syncedImageClipIdsRef = useRef<Set<string>>(new Set());
  /**
   * 当前帧可见图片 clip 的 id 集合，供异步 loadImage 后校验，
   * 如果图片异步加载完成时，其 id 已不在可见集，则不应再添加到画布
   */
  const visibleImageIdsRef = useRef<Set<string>>(new Set());
  /** 图片 clip 的滤镜 canvas 缓存，用于应用 brightness/contrast 等效果 */
  const filteredCanvasesRef = useRef<Map<string, HTMLCanvasElement>>(new Map());

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
     *
     * 坐标约定：
     * - project 坐标系中 x/y 为图片左上角位置
     * - 画布上使用中心点坐标 + offset 方式，使旋转/翻转以中心为原点
     * - 同步时：centerX = leftTopX + width/2, offsetX = width/2
     */
    const visibleImageClips: Array<{
      id: string;
      source: string;
      clip: Clip;
      x: number;
      y: number;
      width: number;
      height: number;
      offsetX: number;
      offsetY: number;
      scaleX: number;
      scaleY: number;
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
        // 占位态（loading）时尚未有正确尺寸与 transform，跳过避免先以铺满舞台尺寸 add 再被替换导致双图/闪烁
        if (asset.loading) {
          continue;
        }
        // transform 语义：x/y 为 project 像素（左上角），scaleX/scaleY 为相对 project 比例
        // scaleX/scaleY 可能为负值（表示翻转），需要将符号和绝对值分开：
        // - width/height 使用绝对值（Konva 节点尺寸始终为正）
        // - scaleX/scaleY 的符号传给 Konva 节点用于翻转
        const scaleX = clip.transform?.scaleX ?? 1;
        const scaleY = clip.transform?.scaleY ?? 1;
        const projX = clip.transform?.x ?? 0;
        const projY = clip.transform?.y ?? 0;
        const w = stageW * Math.abs(scaleX);
        const h = stageH * Math.abs(scaleY);
        // 将左上角坐标转换为中心点坐标（画布坐标系）
        const leftTopX = projX * scaleToStageX;
        const leftTopY = projY * scaleToStageY;
        visibleImageClips.push({
          id: clip.id,
          source: asset.source,
          clip,
          x: leftTopX + w / 2,
          y: leftTopY + h / 2,
          width: w,
          height: h,
          offsetX: w / 2,
          offsetY: h / 2,
          scaleX: Math.sign(scaleX) || 1,
          scaleY: Math.sign(scaleY) || 1,
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
      filteredCanvasesRef.current.delete(id);
    }

    // Step2: 增/更新本帧所有应可见图片
    for (const clip of visibleImageClips) {
      // 已同步过，同步更新位置、尺寸及滤镜 canvas
      if (syncedImageClipIdsRef.current.has(clip.id)) {
        const cachedImg = imageCache.get(clip.source);
        if (cachedImg) {
          let canvas = filteredCanvasesRef.current.get(clip.id);
          if (!canvas) {
            canvas = document.createElement("canvas");
            filteredCanvasesRef.current.set(clip.id, canvas);
          }
          drawImageWithFiltersToCanvas(clip.clip, canvas, cachedImg, clip.width, clip.height);
          editor.updateImage(clip.id, {
            image: canvas,
            x: clip.x,
            y: clip.y,
            width: clip.width,
            height: clip.height,
            offsetX: clip.offsetX,
            offsetY: clip.offsetY,
            scaleX: clip.scaleX,
            scaleY: clip.scaleY,
            rotation: clip.rotation,
            opacity: clip.opacity,
          });
        } else {
          editor.updateImage(clip.id, {
            x: clip.x,
            y: clip.y,
            width: clip.width,
            height: clip.height,
            offsetX: clip.offsetX,
            offsetY: clip.offsetY,
            scaleX: clip.scaleX,
            scaleY: clip.scaleY,
            rotation: clip.rotation,
            opacity: clip.opacity,
          });
        }
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
            // 绘制到滤镜 canvas 并加入画布（支持 brightness/contrast 等效果）
            const canvas = document.createElement("canvas");
            drawImageWithFiltersToCanvas(
              clip.clip,
              canvas,
              img,
              clip.width,
              clip.height,
            );
            filteredCanvasesRef.current.set(clip.id, canvas);
            editorRef.current.addImage(canvas, {
              id: clip.id,
              x: clip.x,
              y: clip.y,
              width: clip.width,
              height: clip.height,
              offsetX: clip.offsetX,
              offsetY: clip.offsetY,
              scaleX: clip.scaleX,
              scaleY: clip.scaleY,
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

  // project 卸载时清理（仅当 project 变为 null 时才移除所有图片，
  // 不在 project 引用变化时清理，避免每次 updateClipTransform 后图片被删除重建导致 Transformer 脱节）
  useEffect(() => {
    if (project) return;
    const editor = editorRef.current;
    if (!editor) return;
    for (const id of syncedImageClipIdsRef.current) {
      editor.removeImage(id);
    }
    syncedImageClipIdsRef.current.clear();
    filteredCanvasesRef.current.clear();
  }, [editorRef, project]);

  // 暂停时：用 store.currentTime 同步
  // resizeTick 变化时也需重新同步，确保画布缩放后元素位置/大小正确
  useEffect(() => {
    if (isPlaying || !project) return;
    const editor = editorRef.current;
    if (!editor) return;
    syncImageForTime(currentTime);
  }, [editorRef, project, currentTime, isPlaying, resizeTick]);

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
