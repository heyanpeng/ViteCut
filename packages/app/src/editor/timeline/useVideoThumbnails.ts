/**
 * 时间轴视频缩略图模块
 *
 * 职责：
 * - 按工程中的视频 asset 维度缓存缩略图（dataURL + 时间戳），供时间轴 clip 展示。
 * - 初次加载时根据当前时间轴缩放（scaleWidth）生成「够用」数量的缩略图；
 *   用户放大时间轴时，在已有基础上动态追加，避免重复解码。
 * - 使用 Mediabunny 的 CanvasSink.canvasesAtTimestamps 批量按时间戳抽帧，
 *   时间戳单调递增时解码管线最优（每包最多解码一次）。
 *
 * 依赖：@vitecut/project、@vitecut/media、mediabunny
 */
import { useEffect, useState } from "react";
import type { Project } from "@vitecut/project";
import { CanvasSink } from "mediabunny";
import { createInputFromUrl } from "@vitecut/media";

// ---------------------------------------------------------------------------
// 常量：与 Timeline 视觉与缩放规则一致
// ---------------------------------------------------------------------------

/** 轨道内容区域高度（px），与 Timeline 行高一致，缩略图按此高度等比缩放 */
const TRACK_CONTENT_HEIGHT_PX = 50;
/** 每条 clip 缩略图格子最小宽度（px），避免缩放较小时格子过密 */
const MIN_THUMB_CELL_WIDTH_PX = 24;
/** 单素材缩略图数量上限，防止极长视频或极大缩放时生成过多图 */
const MAX_THUMB_COUNT = 512;

// ---------------------------------------------------------------------------
// 类型与工具函数（对外可复用）
// ---------------------------------------------------------------------------

/**
 * 单个视频 asset 的缩略图缓存条目
 * key 为 assetId，value 为该 asset 的缩略图列表及元数据
 */
export type ThumbnailEntry = {
  /** 生成状态：idle 未开始，loading 生成中，done 完成，error 失败 */
  status: "idle" | "loading" | "done" | "error";
  /** 每帧的 dataURL（image/jpeg），与 timestamps 一一对应 */
  urls: string[];
  /** 与 urls 一一对应，timestamps[i] 表示 urls[i] 在素材中的时间（秒） */
  timestamps: number[];
  /** 宽高比，用于展示时计算格子尺寸 */
  aspectRatio?: number;
  /** 素材首帧时间（秒），用于追加阶段计算新时间戳 */
  firstTimestamp?: number;
  /** 素材末帧时间（秒） */
  lastTimestamp?: number;
  /** 素材时长（秒） */
  durationSeconds?: number;
};

/**
 * 按当前时间轴缩放计算「该时长」应生成的缩略图数量
 * 公式：时长 * scaleWidth / 最小格子宽度，再限制在 [16, MAX_THUMB_COUNT]
 */
export const getTargetThumbCount = (
  durationSeconds: number,
  scaleWidth: number,
): number =>
  Math.min(
    MAX_THUMB_COUNT,
    Math.max(
      16,
      durationSeconds > 0
        ? Math.ceil((durationSeconds * scaleWidth) / MIN_THUMB_CELL_WIDTH_PX)
        : 16,
    ),
  );

/**
 * 在已排序的 timestamps 中二分查找最接近 targetTime 的下标
 * 用于展示时：clip 上每一格对应一个「素材时间」，用此函数在缓存里选最近一帧
 */
export const findClosestTimestampIndex = (
  timestamps: number[],
  targetTime: number,
): number => {
  if (timestamps.length === 0) {
    return 0;
  }
  if (timestamps.length === 1) {
    return 0;
  }
  let lo = 0;
  let hi = timestamps.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (timestamps[mid]! <= targetTime) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return Math.abs(timestamps[lo]! - targetTime) <=
    Math.abs(timestamps[hi]! - targetTime)
    ? lo
    : hi;
};

/** getThumbCellsForClip 的返回值：格子 URL 列表 + 宽高比（用于 CSS --thumb-aspect-ratio） */
export type ThumbCellsResult = {
  cells: string[];
  aspectRatio: number;
};

/**
 * 根据已缓存的缩略图数据，计算某条视频 clip 在时间轴上应显示的格子图片 URL 列表
 *
 * 逻辑简述：
 * - 根据 clip 在时间轴上的像素宽度与最小格子宽度，得到可显示的格子数 cellCount
 * - 每个格子对应 clip 时间区间内的一段「素材时间」；取该段中心点的素材时间，
 *   在 timestamps 中找最近一帧，取其 url 作为该格图片
 *
 * 供 Timeline 的 getActionRender 使用；无缓存或数据不全时返回 null（走库默认渲染）
 */
export const getThumbCellsForClip = (
  assetThumb: ThumbnailEntry | undefined,
  clip: { inPoint?: number; start: number; end: number },
  action: { start: number; end: number },
  scaleWidth: number,
  trackContentHeightPx: number,
): ThumbCellsResult | null => {
  if (!assetThumb?.urls?.length || !assetThumb.timestamps?.length) {
    return null;
  }
  const urls = assetThumb.urls;
  const timestamps = assetThumb.timestamps;
  const aspectRatio = assetThumb.aspectRatio ?? 16 / 9;
  const cellWidthPx = trackContentHeightPx * aspectRatio;
  const clipWidthPx = (action.end - action.start) * scaleWidth;
  const minCellWidthPx = Math.max(cellWidthPx, MIN_THUMB_CELL_WIDTH_PX);
  // 用 ceil：最后一段不足一格宽时也占一格，保证最后一个 cell 也有缩略图
  const maxCells = Math.max(1, Math.ceil(clipWidthPx / minCellWidthPx));
  const cellCount = Math.min(urls.length, maxCells);
  const inPoint = clip.inPoint ?? 0;
  const clipStart = action.start;
  const clipEnd = action.end;

  // 每格中心点映射到素材时间，再在缓存中取最近一帧
  const cells = Array.from({ length: cellCount }, (_, j) => {
    const sourceTime =
      inPoint + ((j + 0.5) / cellCount) * (clipEnd - clipStart);
    const idx = findClosestTimestampIndex(timestamps, sourceTime);
    return urls[Math.min(idx, urls.length - 1)] ?? "";
  });

  return { cells, aspectRatio };
};

// ---------------------------------------------------------------------------
// Hook：按 asset 维度的缩略图缓存
// ---------------------------------------------------------------------------

/**
 * 按 asset 维度缓存视频缩略图
 *
 * - 初次：对每个「有 source 的视频 asset」若尚未开始或未完成，则启动异步生成；
 *   使用 CanvasSink.canvasesAtTimestamps(timestamps) 批量抽帧，时间戳单调递增，
 *   解码管线最优；全部帧生成完后一次性 setState，避免每帧触发重渲染。
 * - 放大：当 scaleWidth 变大导致 getTargetThumbCount 大于当前 urls.length 时，
 *   仅对「不足」的那一段时间戳再次打开媒体并 canvasesAtTimestamps 追加，
 *   结果与已有 urls/timestamps 拼接后一次 setState。
 *
 * @param project 当前工程（null 时不生成）
 * @param scaleWidth 时间轴每秒对应的像素宽度，用于计算目标缩略图数量
 * @returns Record<assetId, ThumbnailEntry>
 */
export const useVideoThumbnails = (
  project: Project | null,
  scaleWidth: number,
): Record<string, ThumbnailEntry> => {
  const [videoThumbnails, setVideoThumbnails] = useState<
    Record<string, ThumbnailEntry>
  >({});

  /**
   * 初次生成：对每个视频 asset 若状态为 idle 或可重试，则启动一次生成任务
   * 依赖 [project, videoThumbnails]，不依赖 scaleWidth（用当前闭包里的 scaleWidth 算数量即可）
   */
  useEffect(() => {
    if (!project) {
      return;
    }

    const videoAssets = project.assets.filter(
      (a) => a.kind === "video" && a.source,
    );

    for (const asset of videoAssets) {
      const existing = videoThumbnails[asset.id];
      if (existing && existing.status !== "idle") {
        continue;
      }

      setVideoThumbnails((prev) => ({
        ...prev,
        [asset.id]: {
          status: "loading",
          urls: existing?.urls ?? [],
          timestamps: existing?.timestamps ?? [],
          aspectRatio: existing?.aspectRatio,
        },
      }));

      void (async () => {
        try {
          const input = createInputFromUrl(asset.source!);
          const videoTrack = await input.getPrimaryVideoTrack();
          const track: any = videoTrack as any;
          if (!track || !(await track.canDecode())) {
            throw new Error("无法解码视频轨道");
          }

          const firstTimestamp = await track.getFirstTimestamp();
          const lastTimestamp = await track.computeDuration();
          const durationSeconds = lastTimestamp - firstTimestamp || 0;

          const aspectRatio =
            track.displayHeight > 0
              ? track.displayWidth / track.displayHeight
              : 16 / 9;

          const THUMB_COUNT = getTargetThumbCount(durationSeconds, scaleWidth);
          // 均匀取 THUMB_COUNT 个时间点（每段中心），保证单调递增以利用批量解码优化
          const timestamps = Array.from({ length: THUMB_COUNT }, (_, i) => {
            const ratio = (i + 0.5) / THUMB_COUNT;
            return firstTimestamp + ratio * (lastTimestamp - firstTimestamp);
          });

          const targetHeight = TRACK_CONTENT_HEIGHT_PX;
          const height = targetHeight;
          const width = Math.max(1, Math.round(targetHeight * aspectRatio));

          const sink: any = new CanvasSink(track, {
            width,
            height,
            fit: "cover",
          });

          // 使用 canvasesAtTimestamps 批量解码（时间戳已有序，每包最多解码一次）
          const urls: string[] = [];
          let lastDataUrl = "";
          for await (const wrapped of sink.canvasesAtTimestamps(timestamps)) {
            let dataUrl = "";
            if (wrapped) {
              try {
                const canvas = wrapped.canvas as HTMLCanvasElement;
                dataUrl = canvas.toDataURL("image/jpeg", 0.82);
              } catch {
                // 单帧编码失败忽略
              }
            }
            if (!dataUrl) {
              dataUrl = lastDataUrl;
            } else {
              lastDataUrl = dataUrl;
            }
            urls.push(dataUrl);
          }

          setVideoThumbnails((prev) => {
            const assetStillExists = project.assets.some(
              (a) => a.id === asset.id,
            );
            if (!assetStillExists) {
              return prev;
            }
            return {
              ...prev,
              [asset.id]: {
                status: "done",
                urls,
                timestamps: timestamps.slice(),
                aspectRatio,
                firstTimestamp,
                lastTimestamp,
                durationSeconds,
              },
            };
          });
        } catch {
          setVideoThumbnails((prev) => {
            const prevEntry = prev[asset.id];
            return {
              ...prev,
              [asset.id]: {
                status: "error",
                urls: [],
                timestamps: [],
                aspectRatio: prevEntry?.aspectRatio ?? 16 / 9,
              },
            };
          });
        }
      })();
    }
  }, [project, videoThumbnails]);

  /**
   * 放大时动态追加：当某 asset 已 done 且 targetCount > 当前 urls.length 时，
   * 仅对「新增」的时间戳区间再次打开媒体并抽帧，结果拼接到已有数据后一次 setState
   * 依赖 scaleWidth：缩放变化时重新计算 targetCount 并可能触发追加
   */
  useEffect(() => {
    if (!project) {
      return;
    }

    const videoAssets = project.assets.filter(
      (a) => a.kind === "video" && a.source,
    );

    for (const asset of videoAssets) {
      const existing = videoThumbnails[asset.id];
      if (
        existing?.status !== "done" ||
        existing.durationSeconds == null ||
        existing.firstTimestamp == null ||
        existing.lastTimestamp == null
      ) {
        continue;
      }

      const targetCount = getTargetThumbCount(
        existing.durationSeconds,
        scaleWidth,
      );
      if (targetCount <= existing.urls.length) {
        continue;
      }

      setVideoThumbnails((prev) => ({
        ...prev,
        [asset.id]: { ...existing, status: "loading" as const },
      }));

      void (async () => {
        const firstTimestamp = existing.firstTimestamp!;
        const lastTimestamp = existing.lastTimestamp!;
        const aspectRatio = existing.aspectRatio ?? 16 / 9;
        const currentLength = existing.urls.length;

        try {
          const input = createInputFromUrl(asset.source!);
          const videoTrack = await input.getPrimaryVideoTrack();
          const track: any = videoTrack as any;
          if (!track || !(await track.canDecode())) {
            return;
          }

          const targetHeight = TRACK_CONTENT_HEIGHT_PX;
          const height = targetHeight;
          const width = Math.max(1, Math.round(targetHeight * aspectRatio));
          const sink: any = new CanvasSink(track, {
            width,
            height,
            fit: "cover",
          });

          // 仅生成「当前没有」的那一段时间戳，保证单调递增
          const appendTimestamps = Array.from(
            { length: targetCount - currentLength },
            (_, i) => {
              const index = currentLength + i;
              const ratio = (index + 0.5) / targetCount;
              return firstTimestamp + ratio * (lastTimestamp - firstTimestamp);
            },
          );

          const newUrls: string[] = [];
          let lastDataUrl = existing.urls[existing.urls.length - 1] ?? "";
          for await (const wrapped of sink.canvasesAtTimestamps(
            appendTimestamps,
          )) {
            let dataUrl = "";
            if (wrapped) {
              try {
                const canvas = wrapped.canvas as HTMLCanvasElement;
                dataUrl = canvas.toDataURL("image/jpeg", 0.82);
              } catch {
                // 忽略单帧失败
              }
            }
            if (!dataUrl) {
              dataUrl = lastDataUrl;
            } else {
              lastDataUrl = dataUrl;
            }
            newUrls.push(dataUrl);
          }

          setVideoThumbnails((prev) => {
            const cur = prev[asset.id];
            if (
              !cur ||
              cur.status !== "loading" ||
              cur.urls.length >= targetCount
            ) {
              return prev;
            }
            return {
              ...prev,
              [asset.id]: {
                ...cur,
                status: "done",
                urls: cur.urls.concat(newUrls),
                timestamps: cur.timestamps.concat(appendTimestamps),
              },
            };
          });
        } catch {
          // 追加失败时保留已有数据，仅把 status 设回 done 避免卡在 loading
          setVideoThumbnails((prev) => {
            const cur = prev[asset.id];
            if (!cur) {
              return prev;
            }
            return {
              ...prev,
              [asset.id]: { ...cur, status: "done" as const },
            };
          });
        }
      })();
    }
  }, [project, videoThumbnails, scaleWidth]);

  return videoThumbnails;
};
