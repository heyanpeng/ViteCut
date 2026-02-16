/**
 * 时间轴音频波形模块
 *
 * 职责：
 * - 按工程中的音频 asset 维度缓存波形数据（peaks 峰值数组 + 绘制后的 dataURL），供时间轴 clip 展示。
 * - 使用 Web Audio API 的 decodeAudioData 解码音频文件，提取每个采样窗口的峰值。
 * - 将峰值绘制到离屏 Canvas 上，转为 dataURL 供 <img> 渲染。
 * - 缩放时根据新的像素宽度重新采样峰值并重绘，无需重新解码。
 *
 * 架构与 useVideoThumbnails 对称：
 * - 视频：CanvasSink.canvasesAtTimestamps → Canvas → dataURL → <img>
 * - 音频：decodeAudioData → peaks[] → Canvas → dataURL → <img>
 */
import { useEffect, useRef, useState } from "react";
import type { Project } from "@vitecut/project";

// ---------------------------------------------------------------------------
// 常量
// ---------------------------------------------------------------------------

/** 轨道内容区域高度（px），与 Timeline 行高一致 */
const TRACK_CONTENT_HEIGHT_PX = 50;
/** 单个 asset 最大峰值采样数（原始精度），防止极长音频占用过多内存 */
const MAX_RAW_PEAKS = 8192;
/** 波形颜色 */
const WAVEFORM_COLOR = "rgba(255, 255, 255, 0.7)";
/** 波形背景色（透明，由 clip 容器的 CSS 背景提供底色） */
const WAVEFORM_BG = "transparent";
/** 渲染缓存最大条目数，超出时清空重建，防止连续缩放导致内存增长 */
const MAX_RENDER_CACHE_SIZE = 32;

// ---------------------------------------------------------------------------
// 类型
// ---------------------------------------------------------------------------

/**
 * 单个音频 asset 的波形缓存条目（纯数据，不含 mutable cache）
 */
export type WaveformEntry = {
  /** 生成状态 */
  status: "idle" | "loading" | "done" | "error";
  /** 原始峰值数据（归一化到 0~1），解码后一次性生成，缩放时从中重新采样 */
  rawPeaks: number[];
  /** 音频时长（秒） */
  durationSeconds: number;
};

/**
 * 渲染缓存：key 为 `${assetId}:${pixelWidth}`，value 为 dataURL。
 * 与 React state 分离，避免在渲染函数中 mutate state。
 * 由 hook 通过 useRef 持有，通过 getWaveformDataUrl 参数传入。
 */
export type WaveformRenderCache = Map<string, string>;

// ---------------------------------------------------------------------------
// 纯函数：峰值提取与绘制
// ---------------------------------------------------------------------------

/**
 * 从 AudioBuffer 中提取归一化峰值数组。
 * 取所有声道的最大绝对值，归一化到 [0, 1]。
 *
 * @param audioBuffer 解码后的 AudioBuffer
 * @param targetCount 目标峰值数量
 * @returns 归一化峰值数组
 */
const extractPeaks = (
  audioBuffer: AudioBuffer,
  targetCount: number,
): number[] => {
  const channels = audioBuffer.numberOfChannels;
  const totalSamples = audioBuffer.length;
  const count = Math.min(targetCount, totalSamples);
  const samplesPerPeak = Math.floor(totalSamples / count);

  // 预先获取所有声道数据
  const channelDataArrays: Float32Array[] = [];
  for (let ch = 0; ch < channels; ch++) {
    channelDataArrays.push(audioBuffer.getChannelData(ch));
  }

  const peaks: number[] = new Array(count);
  for (let i = 0; i < count; i++) {
    let max = 0;
    const offset = i * samplesPerPeak;
    for (let j = 0; j < samplesPerPeak; j++) {
      for (let ch = 0; ch < channels; ch++) {
        const abs = Math.abs(channelDataArrays[ch]![offset + j]!);
        if (abs > max) {
          max = abs;
        }
      }
    }
    peaks[i] = max;
  }

  // 归一化到 [0, 1]
  let globalMax = 0;
  for (let i = 0; i < count; i++) {
    if (peaks[i]! > globalMax) {
      globalMax = peaks[i]!;
    }
  }
  if (globalMax > 0) {
    for (let i = 0; i < count; i++) {
      peaks[i] = peaks[i]! / globalMax;
    }
  }

  return peaks;
};

/**
 * 从原始峰值数组中重新采样到目标宽度。
 * 每个目标像素取对应区间的最大值。
 */
const resamplePeaks = (rawPeaks: number[], targetWidth: number): number[] => {
  if (rawPeaks.length === 0 || targetWidth <= 0) {
    return [];
  }
  if (rawPeaks.length <= targetWidth) {
    // 原始精度不够，直接拉伸（线性插值）
    return Array.from({ length: targetWidth }, (_, i) => {
      const pos = (i / targetWidth) * rawPeaks.length;
      const lo = Math.floor(pos);
      const hi = Math.min(lo + 1, rawPeaks.length - 1);
      const frac = pos - lo;
      return rawPeaks[lo]! * (1 - frac) + rawPeaks[hi]! * frac;
    });
  }
  // 原始精度足够，取每段最大值
  const samplesPerPixel = rawPeaks.length / targetWidth;
  return Array.from({ length: targetWidth }, (_, i) => {
    const start = Math.floor(i * samplesPerPixel);
    const end = Math.floor((i + 1) * samplesPerPixel);
    let max = 0;
    for (let j = start; j < end; j++) {
      if (rawPeaks[j]! > max) {
        max = rawPeaks[j]!;
      }
    }
    return max;
  });
};

/**
 * 将峰值数组绘制到离屏 Canvas 并返回 dataURL。
 * 波形为上下对称的柱状图（居中镜像），视觉效果更好。
 */
const renderWaveformToDataUrl = (
  peaks: number[],
  width: number,
  height: number,
): string => {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return "";
  }

  ctx.fillStyle = WAVEFORM_BG;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = WAVEFORM_COLOR;
  const centerY = height / 2;
  // 留 2px 上下边距，避免波形顶到边缘
  const maxBarHeight = (height - 4) / 2;

  for (let i = 0; i < peaks.length; i++) {
    const barHeight = Math.max(1, peaks[i]! * maxBarHeight);
    // 每像素画 1px 宽的柱子，上下对称
    ctx.fillRect(i, centerY - barHeight, 1, barHeight * 2);
  }

  return canvas.toDataURL("image/png");
};

// ---------------------------------------------------------------------------
// 公开工具函数：供 Timeline getActionRender 使用
// ---------------------------------------------------------------------------

/**
 * 根据已缓存的波形数据，获取指定像素宽度的波形 dataURL。
 * 如果缓存中没有该宽度的渲染结果，会即时重新采样并绘制（同步操作，很快）。
 *
 * @param entry 波形缓存条目
 * @param assetId asset ID，用于构建缓存 key
 * @param targetWidth 目标像素宽度
 * @param cache 渲染缓存 Map（由 hook 通过 useRef 持有，与 React state 分离）
 * @returns dataURL 或 null（数据未就绪）
 */
export const getWaveformDataUrl = (
  entry: WaveformEntry | undefined,
  assetId: string,
  targetWidth: number,
  cache: WaveformRenderCache,
): string | null => {
  if (!entry || entry.status !== "done" || entry.rawPeaks.length === 0) {
    return null;
  }
  // 四舍五入到整数像素，避免浮点差异导致缓存未命中
  const w = Math.max(1, Math.round(targetWidth));
  const cacheKey = `${assetId}:${w}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    return cached;
  }
  // 缓存超限时清空重建，防止连续缩放导致内存增长
  if (cache.size >= MAX_RENDER_CACHE_SIZE) {
    cache.clear();
  }
  // 即时重新采样 + 绘制（同步，通常 < 1ms）
  const resampled = resamplePeaks(entry.rawPeaks, w);
  const dataUrl = renderWaveformToDataUrl(
    resampled,
    w,
    TRACK_CONTENT_HEIGHT_PX,
  );
  cache.set(cacheKey, dataUrl);
  return dataUrl;
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/** useAudioWaveform 的返回值 */
export type AudioWaveformResult = {
  /** 按 assetId 索引的波形数据 */
  entries: Record<string, WaveformEntry>;
  /** 渲染缓存，传给 getWaveformDataUrl 使用（与 React state 分离） */
  renderCache: WaveformRenderCache;
};

/**
 * 按 asset 维度缓存音频波形数据。
 *
 * - 初次：对每个「有 source 的音频 asset」启动异步解码，提取原始峰值。
 * - 缩放：不需要重新解码，getWaveformDataUrl 会从 rawPeaks 即时重新采样。
 *
 * @param project 当前工程（null 时不生成）
 * @returns AudioWaveformResult
 */
export const useAudioWaveform = (
  project: Project | null,
): AudioWaveformResult => {
  const [waveforms, setWaveforms] = useState<Record<string, WaveformEntry>>({});
  // 用 ref 跟踪正在进行的解码任务，避免重复启动
  const pendingRef = useRef<Set<string>>(new Set());
  // 渲染缓存独立于 React state，避免在渲染函数中 mutate state
  const renderCacheRef = useRef<WaveformRenderCache>(new Map());

  useEffect(() => {
    if (!project) {
      return;
    }

    const audioAssets = project.assets.filter(
      (a) => a.kind === "audio" && a.source,
    );

    for (const asset of audioAssets) {
      const existing = waveforms[asset.id];
      // 已完成或正在加载则跳过
      if (existing && existing.status !== "idle") {
        continue;
      }
      // 防止并发重复启动
      if (pendingRef.current.has(asset.id)) {
        continue;
      }
      pendingRef.current.add(asset.id);

      setWaveforms((prev) => ({
        ...prev,
        [asset.id]: {
          status: "loading" as const,
          rawPeaks: [],
          durationSeconds: 0,
        },
      }));

      void (async () => {
        try {
          // 1. 获取音频文件的 ArrayBuffer
          const response = await fetch(asset.source!);
          const arrayBuffer = await response.arrayBuffer();

          // 2. 用 Web Audio API 解码
          const audioContext = new OfflineAudioContext(1, 1, 44100);
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

          // 3. 提取峰值
          const rawPeaks = extractPeaks(audioBuffer, MAX_RAW_PEAKS);
          const durationSeconds = audioBuffer.duration;

          setWaveforms((prev) => {
            // 确认 asset 仍然存在
            const stillExists = project.assets.some((a) => a.id === asset.id);
            if (!stillExists) {
              return prev;
            }
            return {
              ...prev,
              [asset.id]: {
                status: "done" as const,
                rawPeaks,
                durationSeconds,
              },
            };
          });
        } catch {
          setWaveforms((prev) => ({
            ...prev,
            [asset.id]: {
              status: "error" as const,
              rawPeaks: [],
              durationSeconds: 0,
            },
          }));
        } finally {
          pendingRef.current.delete(asset.id);
        }
      })();
    }
  }, [project, waveforms]);

  return { entries: waveforms, renderCache: renderCacheRef.current };
};
