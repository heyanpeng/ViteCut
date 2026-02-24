import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { shallow } from "zustand/shallow";
import {
  type Project,
  type Asset,
  type Track,
  type Clip,
  createEmptyProject,
  addTrack,
  addClip,
  updateClip,
  getProjectDuration,
  findClipById,
  removeClip,
  reorderTracks as reorderTracksProject,
  setTrackMuted,
} from "@vitecut/project";
import { probeMedia } from "@vitecut/media";
import { renderVideoWithCanvasLoop } from "@vitecut/renderer";
import { createId } from "@vitecut/utils";
import { DEFAULT_MAX_HISTORY } from "@vitecut/history";
import {
  createUpdateClipTimingCommand,
  createDuplicateClipCommand,
  createDeleteClipCommand,
  createCutClipCommand,
  createReorderTracksCommand,
  createToggleTrackMutedCommand,
  createLoadVideoCommand,
  createLoadImageCommand,
  createLoadAudioCommand,
  createSetCanvasBackgroundColorCommand,
  createSetCanvasSizeCommand,
  createUpdateClipTransformCommand,
  createAddTextClipCommand,
  createUpdateClipParamsCommand,
} from "./projectStoreCommands";
import type { ProjectStore } from "./projectStore.types";

/**
 * 获取图片的宽高
 * @param url 图片的 URL
 * @returns 图片的宽高
 */
function getImageDimensions(
  url: string,
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      reject(new Error("Failed to load image"));
    };
    img.src = url;
  });
}

/**
 * 将 [start, end] 约束到与同轨道其他 clip 不重叠的位置，保持时长不变。
 * 若发生重叠则吸附到相邻 clip 的边界（选移动量更小的一侧）。
 */
function constrainClipNoOverlap(
  others: { id: string; start: number; end: number }[],
  _clipId: string,
  start: number,
  end: number,
): { start: number; end: number } {
  const duration = end - start;
  if (duration <= 0) {
    return { start, end };
  }
  let newStart = start;
  let newEnd = end;
  const maxIter = 10;
  for (let iter = 0; iter < maxIter; iter++) {
    const overlapping = others.filter(
      (o) => newStart < o.end && newEnd > o.start,
    );
    if (overlapping.length === 0) {
      break;
    }
    const o = overlapping[0];
    const snapLeftStart = o.start - duration;
    const snapLeftEnd = o.start;
    const snapRightStart = o.end;
    const snapRightEnd = o.end + duration;
    const distLeft = Math.abs(snapLeftStart - newStart);
    const distRight = Math.abs(snapRightStart - newStart);
    if (distLeft <= distRight) {
      newStart = snapLeftStart;
      newEnd = snapLeftEnd;
    } else {
      newStart = snapRightStart;
      newEnd = snapRightEnd;
    }
  }
  newStart = Math.max(0, newStart);
  newEnd = newStart + duration;
  return { start: newStart, end: newEnd };
}

/**
 * ProjectStore（zustand）实现
 * ===========================
 *
 * 该文件只包含“实现逻辑”，对外 API 形状与字段语义详见 `projectStore.types.ts`。
 *
 * 设计约定：
 * - `project` 是工程编辑的单一数据源（轨道/片段/资源/画布尺寸等）。
 * - `currentTime/isPlaying/duration` 是预览播放所需的最小状态集合。
 * - `loading/videoUrl/canvasBackgroundColor` 属于 UI/预览层状态，不应影响工程结构本身。
 *
 * 常见陷阱：
 * - **blob URL 泄露**：`URL.createObjectURL` 创建的 url 需要在不再使用时 `revokeObjectURL`。
 * - **duration 一致性**：增删/移动 clip 后需要重新计算 `duration`，避免播放头越界。
 * - **时间轴拖拽不写回**：若 Timeline 上移动 clip 没有更新 `project` 的 start/end，
 *   Preview 与导出仍会按旧时间区间渲染。
 */
export const useProjectStore = create<ProjectStore>()(
  subscribeWithSelector((set, get) => ({
    // 当前正在编辑的项目数据（Project 对象），为 null 表示尚未载入或新建
    project: null,
    // 预览播放器的当前时间点（以秒为单位）
    currentTime: 0,
    // 当前项目的总时长，会根据片段和轨道自动计算更新
    duration: 0,
    // 播放器当前是否处于播放状态
    isPlaying: false,
    // 界面是否处于加载中（例如媒体探测、工程导入、渲染等异步任务时）
    loading: false,
    // 当前用于预览的视频源（为浏览器 Blob URL 或其他），为 null 时无预览
    videoUrl: null,
    // 预览区域画布的背景色（CSS 颜色字符串）
    canvasBackgroundColor: "#000000",
    // 无工程时用户选择的画布尺寸，导入视频时优先使用
    preferredCanvasSize: { width: 1920, height: 1080 },
    // 用户显式选中的画布预设 value，比例相同时用于正确显示选中项
    preferredCanvasPreset: null,
    // 当前选中的 clip id（画布选中编辑用）
    selectedClipId: null,
    // 时间轴 clip 拖拽时是否启用吸附
    timelineSnapEnabled: true,
    // 已完成的命令历史（用于撤销）
    historyPast: [],
    // 可重做的命令历史（用于重做）
    historyFuture: [],

    /**
     * 添加一条新的命令到历史，并清空可重做历史
     * @param cmd 可撤销/重做的命令对象（必须实现 execute/undo）
     */
    pushHistory(cmd: { execute: () => void; undo: () => void }) {
      const past = get().historyPast;
      // 限制历史长度为 DEFAULT_MAX_HISTORY
      const next = [...past, cmd].slice(-DEFAULT_MAX_HISTORY);
      set({ historyPast: next, historyFuture: [] });
    },

    /**
     * 撤销上一条命令（undo），并将其移动到可重做历史。
     * 若撤销后当前选中的 clip 已不存在于 project，则清除选中状态（同步清除画布选中框）。
     */
    undo() {
      const past = get().historyPast;
      if (past.length === 0) {
        return;
      }
      const cmd = past[past.length - 1];
      cmd.undo();
      const project = get().project;
      const selectedClipId = get().selectedClipId;
      const shouldClearSelection =
        selectedClipId &&
        (!project || !findClipById(project, selectedClipId as Clip["id"]));
      set({
        historyPast: past.slice(0, -1),
        historyFuture: [...get().historyFuture, cmd],
        ...(shouldClearSelection ? { selectedClipId: null } : {}),
      });
    },

    /**
     * 重做上一条撤销的命令（redo）。
     * 若重做后当前选中的 clip 已不存在于 project，则清除选中状态（同步清除画布选中框）。
     */
    async redo() {
      const future = get().historyFuture;
      if (future.length === 0) {
        return;
      }
      const cmd = future[future.length - 1];
      const result = cmd.execute();
      const promise =
        typeof result === "object" &&
        result !== null &&
        "then" in result &&
        typeof (result as Promise<void>).then === "function"
          ? (result as Promise<void>)
          : null;
      if (promise) {
        await promise;
      }
      const project = get().project;
      const selectedClipId = get().selectedClipId;
      const shouldClearSelection =
        selectedClipId &&
        (!project || !findClipById(project, selectedClipId as Clip["id"]));
      set({
        historyPast: [...get().historyPast, cmd],
        historyFuture: future.slice(0, -1),
        ...(shouldClearSelection ? { selectedClipId: null } : {}),
      });
    },

    /**
     * 导入本地视频文件并写入工程。
     *
     * 行为分两种：
     * - **已有工程**：追加 asset + 新建一个视频轨道（order 最大，显示在最上方）+ 新建一个 clip。
     * - **无工程**：创建新工程（宽高来自媒体探测，默认 30fps）+ 主视频轨道 + 主视频 clip。
     *
     * 副作用：
     * - 会创建 blob URL 并写入 asset.source / store.videoUrl。
     * - 会切换 `loading`，并在落盘前重置 `isPlaying=false`。
     */
    async loadVideoFile(file: File, options?: { skipHistory?: boolean }) {
      const prevProject = get().project;
      const prevVideoUrl = get().videoUrl;
      const prevDuration = get().duration;
      const prevCurrentTime = get().currentTime;

      // 为本地文件创建 blob URL，供视频预览与时间轴素材引用
      const blobUrl = URL.createObjectURL(file);

      set({ loading: true });
      try {
        // 探测媒体信息（时长、视频宽高、旋转、音轨信息等）
        const info = await probeMedia({ type: "blob", blob: file });

        const existing = get().project;
        let project: Project;

        if (existing) {
          // 已有工程：新增资源 + 新视频轨道（在最上方）+ 新片段
          const assetId = createId("asset");
          const asset: Asset = {
            id: assetId,
            name: file.name,
            source: blobUrl,
            kind: "video",
            duration: info.duration,
            videoMeta: info.video
              ? {
                  width: info.video.displayWidth,
                  height: info.video.displayHeight,
                  rotation: info.video.rotation,
                  fps: undefined,
                  codec: info.video.codec ?? undefined,
                }
              : undefined,
            audioMeta: info.audio
              ? {
                  sampleRate: info.audio.sampleRate,
                  channels: info.audio.numberOfChannels,
                  codec: info.audio.codec ?? undefined,
                }
              : undefined,
          };

          project = {
            ...existing,
            assets: [...existing.assets, asset],
          };

          const trackId = createId("track");
          // 新轨道的 order 取当前最大值 + 1，使其出现在时间轴最上方
          const topOrder =
            Math.max(...project.tracks.map((t) => t.order), -1) + 1;
          const trackBase: Omit<Track, "clips"> = {
            id: trackId,
            kind: "video",
            name: file.name,
            order: topOrder,
            muted: false,
            hidden: false,
            locked: false,
          };

          project = addTrack(project, trackBase);

          const clipId = createId("clip");
          const currentTime = prevCurrentTime;
          const clip: Clip = {
            id: clipId,
            trackId,
            assetId,
            kind: "video",
            // 初始片段默认铺满整个素材时长，从当前播放头开始
            start: currentTime,
            end: currentTime + info.duration,
            inPoint: 0,
            outPoint: info.duration,
            // 画布位置默认左上角；若需要默认居中可在这里调整
            transform: { x: 0, y: 0 },
          };

          project = addClip(project, clip);
        } else {
          // 无工程：创建新工程，并释放之前可能残留的 blob URL
          const prevUrl = get().videoUrl;
          if (prevUrl) {
            // 避免多次导入导致 blob URL 泄露
            URL.revokeObjectURL(prevUrl);
          }

          const projectId = createId("project");
          // 工程宽高使用用户选择的 preferredCanvasSize（无工程时在画布面板选择的尺寸）
          const { width, height } = get().preferredCanvasSize;

          project = createEmptyProject({
            id: projectId,
            name: file.name,
            // 当前默认 30fps；后续可改为从媒体探测结果推断或由用户设置
            fps: 30,
            width,
            height,
            exportSettings: { format: "mp4" },
          });

          const assetId = createId("asset");
          const asset: Asset = {
            id: assetId,
            name: file.name,
            source: blobUrl,
            kind: "video",
            duration: info.duration,
            videoMeta: info.video
              ? {
                  width: info.video.displayWidth,
                  height: info.video.displayHeight,
                  rotation: info.video.rotation,
                  fps: undefined,
                  codec: info.video.codec ?? undefined,
                }
              : undefined,
            audioMeta: info.audio
              ? {
                  sampleRate: info.audio.sampleRate,
                  channels: info.audio.numberOfChannels,
                  codec: info.audio.codec ?? undefined,
                }
              : undefined,
          };

          project = { ...project, assets: [asset] };

          const trackId = createId("track");
          const trackBase: Omit<Track, "clips"> = {
            id: trackId,
            kind: "video",
            name: "主视频",
            // 首条轨道 order 为 0
            order: 0,
            muted: false,
            hidden: false,
            locked: false,
          };

          project = addTrack(project, trackBase);

          const clipId = createId("clip");
          const clip: Clip = {
            id: clipId,
            trackId,
            assetId,
            kind: "video",
            start: 0,
            end: info.duration,
            inPoint: 0,
            outPoint: info.duration,
            transform: { x: 0, y: 0 },
          };

          project = addClip(project, clip);
        }

        // 工程时长取所有 clip 的 end 最大值
        const duration = getProjectDuration(project);

        set({
          project,
          duration,
          // 保留当前播放头（不强制跳到 0）；但导入后默认暂停
          currentTime: get().currentTime,
          isPlaying: false,
          // videoUrl 当前仅用于主视频预览；这里写入最新导入的视频
          videoUrl: blobUrl,
        });

        if (!options?.skipHistory) {
          get().pushHistory(
            createLoadVideoCommand(
              get,
              set,
              file,
              {
                prevProject,
                prevVideoUrl,
                prevDuration,
                prevCurrentTime,
              },
              blobUrl,
              project,
            ),
          );
        }
      } finally {
        set({ loading: false });
      }
    },

    /**
     * 导入本地图片文件并写入工程。
     * 行为同 loadVideoFile：已有工程则追加 asset + 新轨道 + 新 clip；无工程则创建新工程。
     * 图片 clip 默认时长 5 秒。
     */
    async loadImageFile(file: File, options?: { skipHistory?: boolean }) {
      const prevProject = get().project;
      const prevDuration = get().duration;
      const prevCurrentTime = get().currentTime;
      const blobUrl = URL.createObjectURL(file);
      const DEFAULT_IMAGE_DURATION = 5;

      set({ loading: true });
      try {
        let imgW: number;
        let imgH: number;
        try {
          const dims = await getImageDimensions(blobUrl);
          imgW = dims.width;
          imgH = dims.height;
        } catch (dimErr) {
          URL.revokeObjectURL(blobUrl);
          throw dimErr;
        }
        const existing = get().project;
        let project: Project;

        const getStageSizeForImage = (): { w: number; h: number } => {
          const proj = get().project;
          if (proj) {
            return { w: proj.width, h: proj.height };
          }
          const { width, height } = get().preferredCanvasSize;
          return { w: width, h: height };
        };

        const { w: stageW, h: stageH } = getStageSizeForImage();
        const containScale = Math.min(
          stageW / Math.max(1, imgW),
          stageH / Math.max(1, imgH),
        );
        const displayW = imgW * containScale;
        const displayH = imgH * containScale;
        // scaleX/Y: 相对于 project 宽/高的显示比例，渲染时 width = stageW * scaleX
        const scaleX = displayW / Math.max(1, stageW);
        const scaleY = displayH / Math.max(1, stageH);
        // x/y: 基于 project 坐标系的像素值，渲染时需乘以 scaleToStageX/Y 转为 stage 坐标
        const x = (stageW - displayW) / 2;
        const y = (stageH - displayH) / 2;
        const initialTransform = { x, y, scaleX, scaleY };

        if (existing) {
          const assetId = createId("asset");
          const asset: Asset = {
            id: assetId,
            name: file.name,
            source: blobUrl,
            kind: "image",
            duration: DEFAULT_IMAGE_DURATION,
            imageMeta: { width: imgW, height: imgH },
          };
          project = {
            ...existing,
            assets: [...existing.assets, asset],
          };
          const trackId = createId("track");
          const topOrder =
            Math.max(...project.tracks.map((t) => t.order), -1) + 1;
          project = addTrack(project, {
            id: trackId,
            kind: "video",
            name: file.name,
            order: topOrder,
            muted: false,
            hidden: false,
            locked: false,
            clips: [],
          });
          const clipId = createId("clip");
          const currentTime = prevCurrentTime;
          const clip: Clip = {
            id: clipId,
            trackId,
            assetId,
            kind: "image",
            start: currentTime,
            end: currentTime + DEFAULT_IMAGE_DURATION,
            inPoint: 0,
            outPoint: DEFAULT_IMAGE_DURATION,
            transform: initialTransform,
          };
          project = addClip(project, clip);
        } else {
          const { width: canvasW, height: canvasH } = get().preferredCanvasSize;
          const projectId = createId("project");
          project = createEmptyProject({
            id: projectId,
            name: file.name,
            fps: 30,
            width: canvasW,
            height: canvasH,
            exportSettings: { format: "mp4" },
          });
          const assetId = createId("asset");
          const asset: Asset = {
            id: assetId,
            name: file.name,
            source: blobUrl,
            kind: "image",
            duration: DEFAULT_IMAGE_DURATION,
            imageMeta: { width: imgW, height: imgH },
          };
          project = { ...project, assets: [asset] };
          const trackId = createId("track");
          project = addTrack(project, {
            id: trackId,
            kind: "video",
            name: "图片",
            order: 0,
            muted: false,
            hidden: false,
            locked: false,
            clips: [],
          });
          const clipId = createId("clip");
          const currentTime = prevCurrentTime;
          const clip: Clip = {
            id: clipId,
            trackId,
            assetId,
            kind: "image",
            start: currentTime,
            end: currentTime + DEFAULT_IMAGE_DURATION,
            inPoint: 0,
            outPoint: DEFAULT_IMAGE_DURATION,
            transform: initialTransform,
          };
          project = addClip(project, clip);
        }

        const duration = getProjectDuration(project);
        set({
          project,
          duration,
          currentTime: get().currentTime,
          isPlaying: false,
        });
        if (!options?.skipHistory) {
          get().pushHistory(
            createLoadImageCommand(
              get,
              set,
              file,
              { prevProject, prevDuration, prevCurrentTime },
              blobUrl,
              project,
            ),
          );
        }
      } finally {
        set({ loading: false });
      }
    },

    /**
     * 导入本地音频文件并写入工程。
     * 行为同 loadVideoFile：已有工程则追加 asset + 新音频轨道 + 新 clip；无工程则创建新工程。
     * 音频 clip 时长等于音频文件时长。
     */
    async loadAudioFile(file: File, options?: { skipHistory?: boolean }) {
      const prevProject = get().project;
      const prevDuration = get().duration;
      const prevCurrentTime = get().currentTime;
      const blobUrl = URL.createObjectURL(file);

      set({ loading: true });
      try {
        // 探测媒体信息（时长、音轨信息等）
        const info = await probeMedia({ type: "blob", blob: file });

        if (!info.audio) {
          URL.revokeObjectURL(blobUrl);
          console.warn("该文件不包含音频轨道");
          return;
        }

        const audioDuration = info.duration;
        if (audioDuration <= 0) {
          URL.revokeObjectURL(blobUrl);
          console.warn("音频时长为 0");
          return;
        }

        const existing = get().project;
        let project: Project;

        if (existing) {
          // 已有工程：新增资源 + 新音频轨道 + 新片段
          const assetId = createId("asset");
          const asset: Asset = {
            id: assetId,
            name: file.name,
            source: blobUrl,
            kind: "audio",
            duration: audioDuration,
            audioMeta: {
              sampleRate: info.audio.sampleRate,
              channels: info.audio.numberOfChannels,
              codec: info.audio.codec ?? undefined,
            },
          };

          project = {
            ...existing,
            assets: [...existing.assets, asset],
          };

          const trackId = createId("track");
          const topOrder =
            Math.max(...project.tracks.map((t) => t.order), -1) + 1;
          project = addTrack(project, {
            id: trackId,
            kind: "audio",
            name: file.name,
            order: topOrder,
            muted: false,
            hidden: false,
            locked: false,
            clips: [],
          });

          const clipId = createId("clip");
          const currentTime = prevCurrentTime;
          const clip: Clip = {
            id: clipId,
            trackId,
            assetId,
            kind: "audio",
            start: currentTime,
            end: currentTime + audioDuration,
            inPoint: 0,
            outPoint: audioDuration,
          };

          project = addClip(project, clip);
        } else {
          // 无工程：创建新工程
          const { width: canvasW, height: canvasH } = get().preferredCanvasSize;
          const projectId = createId("project");
          project = createEmptyProject({
            id: projectId,
            name: file.name,
            fps: 30,
            width: canvasW,
            height: canvasH,
            exportSettings: { format: "mp4" },
          });

          const assetId = createId("asset");
          const asset: Asset = {
            id: assetId,
            name: file.name,
            source: blobUrl,
            kind: "audio",
            duration: audioDuration,
            audioMeta: {
              sampleRate: info.audio.sampleRate,
              channels: info.audio.numberOfChannels,
              codec: info.audio.codec ?? undefined,
            },
          };
          project = { ...project, assets: [asset] };

          const trackId = createId("track");
          project = addTrack(project, {
            id: trackId,
            kind: "audio",
            name: "音频",
            order: 0,
            muted: false,
            hidden: false,
            locked: false,
            clips: [],
          });

          const clipId = createId("clip");
          const currentTime = prevCurrentTime;
          const clip: Clip = {
            id: clipId,
            trackId,
            assetId,
            kind: "audio",
            start: currentTime,
            end: currentTime + audioDuration,
            inPoint: 0,
            outPoint: audioDuration,
          };
          project = addClip(project, clip);
        }

        const duration = getProjectDuration(project);
        set({
          project,
          duration,
          currentTime: get().currentTime,
          isPlaying: false,
        });
        if (!options?.skipHistory) {
          get().pushHistory(
            createLoadAudioCommand(
              get,
              set,
              file,
              { prevProject, prevDuration, prevCurrentTime },
              blobUrl,
              project,
            ),
          );
        }
      } finally {
        set({ loading: false });
      }
    },

    /**
     * 设置预览播放头时间（秒）。
     * Timeline 拖动、预览播放 rAF 推进都会调用这里。
     */
    setCurrentTime(time: number) {
      set({ currentTime: time });
    },

    /**
     * 切换播放状态。
     * 实际帧渲染与调度由 Preview（usePreviewVideo）驱动。
     */
    setIsPlaying(isPlaying: boolean) {
      set({ isPlaying });
    },

    /**
     * 设置预览画布背景色（UI 状态）。
     * 注意：当前仅影响预览，不参与导出（若要导出背景色，需要写入工程数据结构）。
     */
    setCanvasBackgroundColor(color: string, skipHistory?: boolean) {
      const prevColor = get().canvasBackgroundColor;
      set({ canvasBackgroundColor: color });
      if (!skipHistory) {
        get().pushHistory(
          createSetCanvasBackgroundColorCommand(set, prevColor, color),
        );
      }
    },

    setTimelineSnapEnabled(enabled: boolean) {
      set({ timelineSnapEnabled: enabled });
    },

    /**
     * 设置画布尺寸（width/height）。
     * - 有工程时：更新 project 并支持撤销；
     * - 无工程时：更新 preferredCanvasSize，导入视频时将使用此尺寸。
     * @param preset 预设 value（如 "wechat-video-16:9"），用于比例相同时正确显示选中项
     */
    setCanvasSize(width: number, height: number, preset?: string) {
      const project = get().project;
      const updates: {
        preferredCanvasSize: { width: number; height: number };
        preferredCanvasPreset: string | null;
      } = {
        preferredCanvasSize: { width, height },
        preferredCanvasPreset: preset ?? null,
      };

      if (project) {
        const prevWidth = project.width;
        const prevHeight = project.height;
        if (prevWidth === width && prevHeight === height && !preset) return;

        const nextProject = {
          ...project,
          width,
          height,
          updatedAt: new Date().toISOString(),
        };
        set({ project: nextProject, ...updates });
        if (prevWidth !== width || prevHeight !== height) {
          get().pushHistory(
            createSetCanvasSizeCommand(
              get,
              set,
              prevWidth,
              prevHeight,
              width,
              height,
            ),
          );
        }
      } else {
        set(updates);
      }
    },

    /**
     * 复制指定 clip，新 clip 放在同一轨道最后一个 clip 之后。
     */
    duplicateClip(clipId: string) {
      const project = get().project;
      if (!project) return;
      const clip = findClipById(project, clipId as Clip["id"]);
      if (!clip) return;
      const track = project.tracks.find((t) => t.id === clip.trackId);
      if (!track) return;
      const lastEnd =
        track.clips.length === 0
          ? 0
          : Math.max(...track.clips.map((c) => c.end));
      const duration = clip.end - clip.start;
      const newClip: Clip = {
        ...clip,
        id: createId("clip") as Clip["id"],
        start: lastEnd,
        end: lastEnd + duration,
      };
      const nextProject = addClip(project, newClip);
      set({
        project: nextProject,
        duration: getProjectDuration(nextProject),
      });
      get().pushHistory(createDuplicateClipCommand(get, set, newClip));
    },

    /**
     * 在播放头位置将指定 clip 切成两段，仅当播放头在 clip 时间范围内时生效。
     */
    cutClip(clipId: string) {
      const project = get().project;
      if (!project) return;
      const currentTime = get().currentTime;
      const clip = findClipById(project, clipId as Clip["id"]);
      if (!clip) return;
      if (currentTime <= clip.start || currentTime >= clip.end) return;

      const inPoint = clip.inPoint ?? 0;
      // 获取 asset 的时长，用于计算 outPoint 的默认值
      const asset = project.assets.find((a) => a.id === clip.assetId);
      const assetDuration = asset?.duration ?? clip.end - clip.start;
      const outPoint = clip.outPoint ?? assetDuration;

      const leftClip: Clip = {
        ...clip,
        end: currentTime,
        outPoint: inPoint + (currentTime - clip.start),
      };
      const rightClip: Clip = {
        ...clip,
        id: createId("clip") as Clip["id"],
        start: currentTime,
        inPoint: inPoint + (currentTime - clip.start),
        outPoint: outPoint, // 保持原始 clip 的 outPoint
      };

      const tracks = project.tracks.map((track) => {
        if (track.id !== clip.trackId) return track;
        const newClips = track.clips.flatMap((c) =>
          c.id === clipId ? [leftClip, rightClip] : [c],
        );
        return { ...track, clips: newClips };
      });
      const nextProject = {
        ...project,
        tracks,
        updatedAt: new Date().toISOString(),
      };
      set({
        project: nextProject,
        duration: getProjectDuration(nextProject),
      });
      get().pushHistory(
        createCutClipCommand(get, set, clip, leftClip, rightClip),
      );
    },

    /**
     * 从工程中删除指定 clip，并重新计算 duration、回退越界的 currentTime。
     */
    deleteClip(clipId: string) {
      const project = get().project;
      if (!project) return;
      const clip = findClipById(project, clipId as Clip["id"]);
      if (!clip) return;
      const nextProject = removeClip(project, clipId as Clip["id"]);
      const duration = getProjectDuration(nextProject);
      const currentTime = Math.min(get().currentTime, duration);
      set({
        project: nextProject,
        duration,
        currentTime,
      });
      get().pushHistory(createDeleteClipCommand(get, set, clip, currentTime));
    },

    /**
     * 在播放头位置添加文字片段，默认 5 秒，文案「标题文字」。
     * 无工程时创建空工程（使用 preferredCanvasSize）。
     *
     * @param text 初始文案，例如「正文」「标题1」等
     * @param fontSize 可选的初始字号，不传则使用默认字号
     */
    addTextClip(text = "标题文字", fontSize?: number) {
      const prevProject = get().project;
      const currentTime = get().currentTime;
      const { preferredCanvasSize } = get();

      let project: Project;
      if (!prevProject) {
        project = createEmptyProject({
          id: createId("project") as Project["id"],
          name: "未命名",
          fps: 30,
          width: preferredCanvasSize.width,
          height: preferredCanvasSize.height,
        });
      } else {
        project = prevProject;
      }

      const assetId = createId("asset");
      const asset: Asset = {
        id: assetId,
        name: "文本",
        source: "",
        kind: "text",
        duration: 0,
        textMeta: { initialText: text },
      };
      project = { ...project, assets: [...project.assets, asset] };

      const trackId = createId("track");
      const topOrder =
        project.tracks.length === 0
          ? 0
          : Math.max(...project.tracks.map((t) => t.order), -1) + 1;
      const trackBase: Omit<Track, "clips"> = {
        id: trackId,
        kind: "mixed",
        name: "文本",
        order: topOrder,
        muted: false,
        hidden: false,
        locked: false,
      };
      project = addTrack(project, trackBase);

      const clipId = createId("clip");
      const defaultDuration = 5;
      const baseFontSize = 96;
      const resolvedFontSize = fontSize ?? baseFontSize;
      const lineHeight = 1;
      const estimatedTextWidth = text.length * resolvedFontSize;
      const estimatedTextHeight = resolvedFontSize * lineHeight;
      const clip: Clip = {
        id: clipId,
        trackId,
        assetId,
        kind: "text",
        start: currentTime,
        end: currentTime + defaultDuration,
        transform: {
          x: project.width / 2,
          y: project.height / 2,
          anchorX: estimatedTextWidth / 2,
          anchorY: estimatedTextHeight / 2,
        },
        params: {
          text,
          fontSize: resolvedFontSize,
          fill: "#ffffff",
          lineHeight,
          letterSpacing: 1,
        },
      };
      project = addClip(project, clip);

      const duration = getProjectDuration(project);
      set({
        project,
        duration,
        currentTime: Math.min(currentTime, duration),
        selectedClipId: clipId,
      });
      get().pushHistory(
        createAddTextClipCommand(
          get,
          set,
          prevProject,
          project,
          clipId,
          trackId,
          assetId,
        ),
      );
    },

    /**
     * 在播放头位置添加形状片段。
     * 形状以 SVG data URL 作为图片 source，复用图片渲染管线。
     */
    addShapeClip(
      svgDataUrl: string,
      shapeSize: { width: number; height: number },
      name = "形状",
    ) {
      const prevProject = get().project;
      const currentTime = get().currentTime;
      const { preferredCanvasSize } = get();

      let project: Project;
      if (!prevProject) {
        project = createEmptyProject({
          id: createId("project") as Project["id"],
          name: "未命名",
          fps: 30,
          width: preferredCanvasSize.width,
          height: preferredCanvasSize.height,
        });
      } else {
        project = prevProject;
      }

      const stageW = project.width;
      const stageH = project.height;
      const imgW = shapeSize.width;
      const imgH = shapeSize.height;

      // contain 缩放：形状默认占画布 30% 宽度，保持比例
      const targetW = stageW * 0.3;
      const containScale = targetW / Math.max(1, imgW);
      const displayW = imgW * containScale;
      const displayH = imgH * containScale;
      const scaleX = displayW / Math.max(1, stageW);
      const scaleY = displayH / Math.max(1, stageH);
      const x = (stageW - displayW) / 2;
      const y = (stageH - displayH) / 2;

      const assetId = createId("asset");
      const asset: Asset = {
        id: assetId,
        name,
        source: svgDataUrl,
        kind: "image",
        duration: 0,
        imageMeta: { width: imgW, height: imgH },
      };
      project = { ...project, assets: [...project.assets, asset] };

      const trackId = createId("track");
      const topOrder =
        project.tracks.length === 0
          ? 0
          : Math.max(...project.tracks.map((t) => t.order), -1) + 1;
      project = addTrack(project, {
        id: trackId,
        kind: "video",
        name,
        order: topOrder,
        muted: false,
        hidden: false,
        locked: false,
      });

      const clipId = createId("clip");
      const defaultDuration = 5;
      const clip: Clip = {
        id: clipId,
        trackId,
        assetId,
        kind: "image",
        start: currentTime,
        end: currentTime + defaultDuration,
        transform: { x, y, scaleX, scaleY },
      };
      project = addClip(project, clip);

      const duration = getProjectDuration(project);
      set({
        project,
        duration,
        currentTime: Math.min(currentTime, duration),
        selectedClipId: clipId,
      });
      get().pushHistory(
        createAddTextClipCommand(
          get,
          set,
          prevProject,
          project,
          clipId,
          trackId,
          assetId,
        ),
      );
    },

    /**
     * 更新时间轴上某个 clip 的时间区间（start/end，单位：秒）。
     *
     * 触发来源：
     * - Timeline 上拖拽移动 clip（onActionMoveEnd）
     * - Timeline 上裁剪/拉伸 clip（onActionResizeEnd）
     *
     * 同轨道不重叠：会先根据该轨道上其他 clip 的区间修正 start/end，再写回，
     * 保证同一轨道内 clip 之间不重叠（吸附到相邻 clip 边界），并保持 clip 时长不变。
     *
     * 为什么要写回：
     * - Preview 与导出都依赖 `project.tracks[].clips[].start/end` 判断可见性与渲染区间。
     */
    updateClipTiming(
      clipId: string,
      start: number,
      end: number,
      trackId?: string,
    ) {
      const project = get().project;
      if (!project) {
        return;
      }

      const clipBefore = findClipById(project, clipId as Clip["id"]);
      const prevStart = clipBefore?.start ?? start;
      const prevEnd = clipBefore?.end ?? end;
      const prevTrackId = clipBefore?.trackId;

      const effectiveTrackId =
        trackId ?? findClipById(project, clipId)?.trackId;
      const track = effectiveTrackId
        ? project.tracks.find((t) => t.id === effectiveTrackId)
        : undefined;
      const others = track ? track.clips.filter((c) => c.id !== clipId) : [];
      const { start: constrainedStart, end: constrainedEnd } = get()
        .timelineSnapEnabled
        ? constrainClipNoOverlap(others, clipId, start, end)
        : { start, end };

      // 音频 clip 在 resize（时长变化）时同步更新 inPoint/outPoint（用于限制可拉长回默认长度）
      let patchInPoint: number | undefined;
      let patchOutPoint: number | undefined;
      const prevDuration = prevEnd - prevStart;
      const nextDuration = constrainedEnd - constrainedStart;
      if (
        clipBefore?.kind === "audio" &&
        Math.abs(prevDuration - nextDuration) > 1e-6
      ) {
        const asset = project.assets.find((a) => a.id === clipBefore.assetId);
        const assetDuration = asset?.duration ?? prevEnd - prevStart;
        const prevInPoint = clipBefore.inPoint ?? 0;
        const prevOutPoint = clipBefore.outPoint ?? assetDuration;
        const deltaStart = constrainedStart - prevStart;
        const deltaEnd = constrainedEnd - prevEnd;
        const rawIn = prevInPoint + deltaStart;
        const rawOut = prevOutPoint + deltaEnd;
        patchInPoint = Math.max(0, Math.min(assetDuration, rawIn));
        patchOutPoint = Math.max(
          patchInPoint + 0.001,
          Math.min(assetDuration, rawOut),
        );
      }

      // 用 @vitecut/project 的纯函数更新 clip；必要时同时更新归属轨道
      const nextProject = updateClip(project, clipId, {
        start: constrainedStart,
        end: constrainedEnd,
        ...(trackId ? { trackId } : {}),
        ...(patchInPoint !== undefined ? { inPoint: patchInPoint } : {}),
        ...(patchOutPoint !== undefined ? { outPoint: patchOutPoint } : {}),
      });

      // 更新 clip 可能导致工程总时长变化，因此需要重新计算 duration
      const duration = getProjectDuration(nextProject);
      // 播放头不能超过工程时长，否则预览/时间轴会出现越界状态
      const currentTime = Math.min(get().currentTime, duration);

      set({
        project: nextProject,
        duration,
        currentTime,
      });
      get().pushHistory(
        createUpdateClipTimingCommand(
          get,
          set,
          clipId,
          prevStart,
          prevEnd,
          prevTrackId,
          constrainedStart,
          constrainedEnd,
          effectiveTrackId,
          clipBefore?.kind === "audio" ? (clipBefore.inPoint ?? 0) : undefined,
          clipBefore?.kind === "audio"
            ? (clipBefore.outPoint ??
                project.assets.find((a) => a.id === clipBefore.assetId)
                  ?.duration ??
                prevEnd - prevStart)
            : undefined,
          patchInPoint,
          patchOutPoint,
        ),
      );
    },

    reorderTracks(orderedTrackIds: string[]) {
      const project = get().project;
      if (!project || orderedTrackIds.length === 0) {
        return;
      }
      const previousOrder = project.tracks.map((t) => t.id);
      const nextProject = reorderTracksProject(project, orderedTrackIds);
      set({ project: nextProject });
      get().pushHistory(
        createReorderTracksCommand(get, set, previousOrder, orderedTrackIds),
      );
    },

    /**
     * 切换指定轨道的静音状态（true/false）。
     */
    toggleTrackMuted(trackId: string) {
      const project = get().project;
      if (!project) {
        return;
      }
      const track = project.tracks.find((t) => t.id === trackId);
      if (!track) {
        return;
      }
      const previousMuted = track.muted ?? false;
      const nextProject = setTrackMuted(project, trackId, !track.muted);
      set({ project: nextProject });
      get().pushHistory(
        createToggleTrackMutedCommand(
          get,
          set,
          trackId,
          previousMuted,
          !track.muted,
        ),
      );
    },

    /**
     * 导出工程为 mp4（最小可用版本）。
     *
     * 当前实现说明：
     * - 先用一个 `<video>` 元素按时间 seek 来取帧；
     * - 每帧画到离屏 canvas；
     * - 交给 `renderVideoWithCanvasLoop` 编码输出。
     *
     * 注意：
     * - 目前导出逻辑只使用 `mainAsset`（第一个 video asset）做逐帧采样，
     *   尚未把多轨合成、文字/图片覆盖层等纳入导出流程（未来可复用 Preview 的渲染管线）。
     */
    async exportToMp4(
      onProgress?: (progress: number) => void,
    ): Promise<Blob | null> {
      const { project } = get();
      if (!project) return null;
      if (!project.assets.length) return null;

      const mainAsset = project.assets.find((a) => a.kind === "video");
      if (!mainAsset) return null;

      set({ loading: true });
      try {
        // 准备离屏 canvas
        const canvas = document.createElement("canvas");
        canvas.width = project.width;
        canvas.height = project.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return null;

        // 准备 video 元素用于按时间采样帧
        const video = document.createElement("video");
        video.src = mainAsset.source;
        video.crossOrigin = "anonymous";
        video.muted = true;
        video.playsInline = true;

        // 等待 metadata，确保 duration/尺寸可用
        await new Promise<void>((resolve, reject) => {
          video.addEventListener("loadedmetadata", () => resolve(), {
            once: true,
          });
          video.addEventListener(
            "error",
            () => reject(new Error("视频加载失败")),
            {
              once: true,
            },
          );
        });

        const duration = getProjectDuration(project);

        const output = await renderVideoWithCanvasLoop({
          canvas,
          duration,
          fps: project.fps,
          async renderFrame(time) {
            // 将 video 跳到指定时间，然后绘制到 canvas
            await new Promise<void>((resolve) => {
              const handler = () => {
                video.removeEventListener("seeked", handler);
                resolve();
              };
              video.addEventListener("seeked", handler);
              video.currentTime = Math.min(time, duration);
            });
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          },
          onProgress,
        });

        // 从 BufferTarget 读取编码后的数据
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const target: any = (output as any).target;
        const buffer: ArrayBuffer | Uint8Array | undefined = target?.buffer;
        if (!buffer) return null;

        // mediabunny 的 BufferTarget 可能返回 ArrayBuffer 或 Uint8Array<ArrayBufferLike>
        // 这里统一将其拷贝为普通 ArrayBuffer，再作为 BlobPart 使用，避免 ArrayBufferLike 类型不兼容。
        let arrayBuffer: ArrayBuffer | null = null;

        if (buffer instanceof Uint8Array) {
          const copy = buffer.slice(); // 拷贝一份，确保底层 buffer 可安全使用
          arrayBuffer = copy.buffer;
        } else {
          const view = new Uint8Array(buffer as ArrayBufferLike);
          const copy = view.slice();
          arrayBuffer = copy.buffer;
        }

        if (!arrayBuffer) return null;

        return new Blob([arrayBuffer], { type: "video/mp4" });
      } finally {
        set({ loading: false });
      }
    },

    /**
     * 设置当前选中的 clip id（画布选中编辑用）。
     */
    setSelectedClipId(id: string | null) {
      set({ selectedClipId: id });
    },

    /**
     * 更新指定 clip 的画布变换属性（位置、缩放、旋转等）。
     * 用于 Preview 中选中的元素被移动、缩放、旋转后写回工程数据。
     */
    updateClipTransform(
      clipId: string,
      transform: {
        x?: number;
        y?: number;
        scaleX?: number;
        scaleY?: number;
        rotation?: number;
        width?: number;
        height?: number;
        opacity?: number;
      },
    ) {
      const project = get().project;
      if (!project) return;

      const clip = findClipById(project, clipId as Clip["id"]);
      if (!clip) return;

      const prevTransform = { ...clip.transform };

      // 构建新的 transform（合并现有值和新值）
      const newTransform = {
        ...clip.transform,
        ...transform,
      };

      // 使用 updateClip 更新 clip
      const nextProject = updateClip(project, clipId, {
        transform: newTransform,
      });

      set({ project: nextProject });

      // 创建历史记录命令
      get().pushHistory(
        createUpdateClipTransformCommand(
          get,
          set,
          clipId,
          prevTransform,
          newTransform,
        ),
      );
    },

    /**
     * 瞬时更新 clip 变换（如不透明度），不写入历史。用于调整面板内拖动时的实时预览。
     */
    updateClipTransformTransient(
      clipId: string,
      transform: { opacity?: number },
    ) {
      const project = get().project;
      if (!project) return;

      const clip = findClipById(project, clipId as Clip["id"]);
      if (!clip) return;

      const newTransform = {
        ...clip.transform,
        ...transform,
      };

      const nextProject = updateClip(project, clipId, {
        transform: newTransform,
      });
      set({ project: nextProject });
    },

    /**
     * 将已通过 transient 更新的 transform 提交到历史。在调整面板关闭时调用。
     */
    commitClipTransformChange(
      clipId: string,
      prevTransform: Record<string, unknown>,
    ) {
      const project = get().project;
      if (!project) return;

      const clip = findClipById(project, clipId as Clip["id"]);
      if (!clip) return;

      const nextTransform = clip.transform ?? {};
      get().pushHistory(
        createUpdateClipTransformCommand(
          get,
          set,
          clipId,
          prevTransform,
          nextTransform,
        ),
      );
    },

    /**
     * 更新指定 clip 的 params（文本内容、字体大小、颜色等），支持历史记录。
     */
    updateClipParams(clipId: string, nextParams: Record<string, unknown>) {
      const project = get().project;
      if (!project) return;
      const clip = findClipById(project, clipId as Clip["id"]);
      if (!clip) return;
      const prevParams = clip.params;
      const mergedParams = { ...prevParams, ...nextParams } as Record<
        string,
        unknown
      >;
      const nextProject = updateClip(project, clipId as Clip["id"], {
        params: mergedParams,
      });
      set({ project: nextProject });
      get().pushHistory(
        createUpdateClipParamsCommand(
          get,
          set,
          clipId,
          prevParams,
          mergedParams,
        ),
      );
    },

    /**
     * 瞬时更新 clip params，不写入历史。用于颜色/不透明度拖动时的实时预览。
     */
    updateClipParamsTransient(
      clipId: string,
      nextParams: Record<string, unknown>,
    ) {
      const project = get().project;
      if (!project) return;
      const clip = findClipById(project, clipId as Clip["id"]);
      if (!clip) return;
      const mergedParams = { ...clip.params, ...nextParams } as Record<
        string,
        unknown
      >;
      const nextProject = updateClip(project, clipId as Clip["id"], {
        params: mergedParams,
      });
      set({ project: nextProject });
    },

    /**
     * 将已通过 transient 更新的 params 提交到历史。在拖动/选择结束时调用。
     */
    commitClipParamsChange(
      clipId: string,
      prevParams: Record<string, unknown>,
    ) {
      const project = get().project;
      if (!project) return;
      const clip = findClipById(project, clipId as Clip["id"]);
      if (!clip) return;
      const nextParams = clip.params ?? {};
      get().pushHistory(
        createUpdateClipParamsCommand(get, set, clipId, prevParams, nextParams),
      );
    },
  })),
);

// 当选中的 clip 已不在 project 中时，自动清除选中态（如被删除、裁剪、undo 等）。clip 不在当前时间范围内仍可选中，便于在 timeline 中操作。
useProjectStore.subscribe(
  (state) => ({
    selectedClipId: state.selectedClipId,
    project: state.project,
  }),
  (slice) => {
    const { selectedClipId, project } = slice;
    if (!selectedClipId || !project) return;

    const clip = findClipById(project, selectedClipId as Clip["id"]);
    if (!clip) {
      useProjectStore.setState({ selectedClipId: null });
    }
  },
  { equalityFn: shallow },
);
