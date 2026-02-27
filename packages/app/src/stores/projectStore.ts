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
import { uploadFileToMedia } from "@/utils/uploadFileToMedia";
import { createId } from "@vitecut/utils";
import { DEFAULT_MAX_HISTORY } from "@vitecut/history";
import {
  createUpdateClipTimingCommand,
  createDuplicateClipCommand,
  createDeleteClipCommand,
  createCutClipCommand,
  createTrimClipLeftCommand,
  createTrimClipRightCommand,
  createReorderTracksCommand,
  createToggleTrackMutedCommand,
  createToggleTrackLockedCommand,
  createToggleTrackHiddenCommand,
  createLoadVideoCommand,
  createLoadImageCommand,
  createLoadAudioCommand,
  createResolvePlaceholderCommand,
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
  url: string
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
  end: number
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
      (o) => newStart < o.end && newEnd > o.start
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
    // 用户显式选中的画布预设 value，比例相同时用于正确显示选中项；默认 16:9 通用宽屏
    preferredCanvasPreset: "16:9",
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

      let mediaUrl: string;
      try {
        const { url } = await uploadFileToMedia(file);
        mediaUrl = url;
      } catch (err) {
        console.error("Upload failed:", err);
        throw err;
      }

      // --- 第一步：同步创建占位 clip（loading 态），让 timeline 立即出现 ---
      const PLACEHOLDER_DURATION = 5;
      const assetId = createId("asset");
      const trackId = createId("track");
      const clipId = createId("clip");

      const placeholderAsset: Asset = {
        id: assetId,
        name: file.name,
        source: mediaUrl,
        kind: "video",
        duration: PLACEHOLDER_DURATION,
        loading: true,
      };

      const existing = get().project;
      let placeholderProject: Project;

      if (existing) {
        placeholderProject = {
          ...existing,
          assets: [...existing.assets, placeholderAsset],
        };
        const topOrder =
          Math.max(...placeholderProject.tracks.map((t) => t.order), -1) + 1;
        placeholderProject = addTrack(placeholderProject, {
          id: trackId,
          kind: "video",
          name: file.name,
          order: topOrder,
          muted: false,
          hidden: false,
          locked: false,
        });
        placeholderProject = addClip(placeholderProject, {
          id: clipId,
          trackId,
          assetId,
          kind: "video",
          start: prevCurrentTime,
          end: prevCurrentTime + PLACEHOLDER_DURATION,
          transform: { x: 0, y: 0 },
        });
      } else {
        const prevUrl = get().videoUrl;
        if (prevUrl?.startsWith("blob:")) {
          URL.revokeObjectURL(prevUrl);
        }
        const { width, height } = get().preferredCanvasSize;
        placeholderProject = createEmptyProject({
          id: createId("project"),
          name: file.name,
          fps: 30,
          width,
          height,
          exportSettings: { format: "mp4" },
        });
        placeholderProject = {
          ...placeholderProject,
          assets: [placeholderAsset],
        };
        placeholderProject = addTrack(placeholderProject, {
          id: trackId,
          kind: "video",
          name: "主视频",
          order: 0,
          muted: false,
          hidden: false,
          locked: false,
        });
        placeholderProject = addClip(placeholderProject, {
          id: clipId,
          trackId,
          assetId,
          kind: "video",
          start: 0,
          end: PLACEHOLDER_DURATION,
          transform: { x: 0, y: 0 },
        });
      }

      set({
        project: placeholderProject,
        duration: getProjectDuration(placeholderProject),
        currentTime: get().currentTime,
        isPlaying: false,
        videoUrl: mediaUrl,
      });

      // --- 第二步：异步探测媒体信息，完成后更新 asset 和 clip ---
      try {
        const info = await probeMedia({ type: "blob", blob: file });

        const current = get().project;
        if (!current) return;

        const finalAsset: Asset = {
          ...placeholderAsset,
          duration: info.duration,
          loading: false,
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

        const clipStart = existing ? prevCurrentTime : 0;
        let project: Project = {
          ...current,
          assets: current.assets.map((a) =>
            a.id === assetId ? finalAsset : a
          ),
        };
        project = updateClip(project, clipId, {
          start: clipStart,
          end: clipStart + info.duration,
          inPoint: 0,
          outPoint: info.duration,
        });

        const duration = getProjectDuration(project);
        set({
          project,
          duration,
          currentTime: get().currentTime,
          isPlaying: false,
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
              mediaUrl,
              project
            )
          );
        }
      } catch {
        // 探测失败：移除占位 clip 和 asset
        const current = get().project;
        if (current) {
          let project = removeClip(current, clipId);
          project = {
            ...project,
            tracks: project.tracks.filter((t) => t.id !== trackId),
            assets: project.assets.filter((a) => a.id !== assetId),
          };
          const duration = getProjectDuration(project);
          const hasContent = project.tracks.length > 0;
          set({
            project: hasContent ? project : prevProject,
            duration: hasContent ? duration : prevDuration,
            currentTime: hasContent
              ? Math.min(get().currentTime, duration)
              : prevCurrentTime,
          });
        }
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

      let mediaUrl: string;
      try {
        const { url } = await uploadFileToMedia(file);
        mediaUrl = url;
      } catch (err) {
        console.error("Upload failed:", err);
        throw err;
      }
      const DEFAULT_IMAGE_DURATION = 5;

      // --- 第一步：同步创建占位 clip（loading 态） ---
      const assetId = createId("asset");
      const trackId = createId("track");
      const clipId = createId("clip");

      const placeholderAsset: Asset = {
        id: assetId,
        name: file.name,
        source: mediaUrl,
        kind: "image",
        duration: DEFAULT_IMAGE_DURATION,
        loading: true,
      };

      const existing = get().project;
      let placeholderProject: Project;

      if (existing) {
        placeholderProject = {
          ...existing,
          assets: [...existing.assets, placeholderAsset],
        };
        const topOrder =
          Math.max(...placeholderProject.tracks.map((t) => t.order), -1) + 1;
        placeholderProject = addTrack(placeholderProject, {
          id: trackId,
          kind: "video",
          name: file.name,
          order: topOrder,
          muted: false,
          hidden: false,
          locked: false,
        });
        placeholderProject = addClip(placeholderProject, {
          id: clipId,
          trackId,
          assetId,
          kind: "image",
          start: prevCurrentTime,
          end: prevCurrentTime + DEFAULT_IMAGE_DURATION,
          transform: { x: 0, y: 0 },
        });
      } else {
        const { width: canvasW, height: canvasH } = get().preferredCanvasSize;
        placeholderProject = createEmptyProject({
          id: createId("project"),
          name: file.name,
          fps: 30,
          width: canvasW,
          height: canvasH,
          exportSettings: { format: "mp4" },
        });
        placeholderProject = {
          ...placeholderProject,
          assets: [placeholderAsset],
        };
        placeholderProject = addTrack(placeholderProject, {
          id: trackId,
          kind: "video",
          name: "图片",
          order: 0,
          muted: false,
          hidden: false,
          locked: false,
        });
        placeholderProject = addClip(placeholderProject, {
          id: clipId,
          trackId,
          assetId,
          kind: "image",
          start: prevCurrentTime,
          end: prevCurrentTime + DEFAULT_IMAGE_DURATION,
          transform: { x: 0, y: 0 },
        });
      }

      set({
        project: placeholderProject,
        duration: getProjectDuration(placeholderProject),
        currentTime: get().currentTime,
        isPlaying: false,
      });

      // --- 第二步：异步获取图片尺寸，完成后更新 asset 和 clip transform ---
      try {
        const dims = await getImageDimensions(mediaUrl);
        const imgW = dims.width;
        const imgH = dims.height;

        const current = get().project;
        if (!current) return;

        const stageW = current.width;
        const stageH = current.height;
        const containScale = Math.min(
          stageW / Math.max(1, imgW),
          stageH / Math.max(1, imgH)
        );
        const displayW = imgW * containScale;
        const displayH = imgH * containScale;
        const scaleX = displayW / Math.max(1, stageW);
        const scaleY = displayH / Math.max(1, stageH);
        const x = (stageW - displayW) / 2;
        const y = (stageH - displayH) / 2;
        const initialTransform = { x, y, scaleX, scaleY };

        const finalAsset: Asset = {
          ...placeholderAsset,
          loading: false,
          imageMeta: { width: imgW, height: imgH },
        };

        let project: Project = {
          ...current,
          assets: current.assets.map((a) =>
            a.id === assetId ? finalAsset : a
          ),
        };
        project = updateClip(project, clipId, {
          inPoint: 0,
          outPoint: DEFAULT_IMAGE_DURATION,
          transform: initialTransform,
        });

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
              mediaUrl,
              project
            )
          );
        }
      } catch {
        const current = get().project;
        if (current) {
          let project = removeClip(current, clipId);
          project = {
            ...project,
            tracks: project.tracks.filter((t) => t.id !== trackId),
            assets: project.assets.filter((a) => a.id !== assetId),
          };
          const duration = getProjectDuration(project);
          const hasContent = project.tracks.length > 0;
          set({
            project: hasContent ? project : prevProject,
            duration: hasContent ? duration : prevDuration,
            currentTime: hasContent
              ? Math.min(get().currentTime, duration)
              : prevCurrentTime,
          });
        }
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

      let mediaUrl: string;
      try {
        const { url } = await uploadFileToMedia(file);
        mediaUrl = url;
      } catch (err) {
        console.error("Upload failed:", err);
        throw err;
      }

      // --- 第一步：同步创建占位 clip（loading 态） ---
      const PLACEHOLDER_DURATION = 5;
      const assetId = createId("asset");
      const trackId = createId("track");
      const clipId = createId("clip");

      const placeholderAsset: Asset = {
        id: assetId,
        name: file.name,
        source: mediaUrl,
        kind: "audio",
        duration: PLACEHOLDER_DURATION,
        loading: true,
      };

      const existing = get().project;
      let placeholderProject: Project;

      if (existing) {
        placeholderProject = {
          ...existing,
          assets: [...existing.assets, placeholderAsset],
        };
        const topOrder =
          Math.max(...placeholderProject.tracks.map((t) => t.order), -1) + 1;
        placeholderProject = addTrack(placeholderProject, {
          id: trackId,
          kind: "audio",
          name: file.name,
          order: topOrder,
          muted: false,
          hidden: false,
          locked: false,
        });
        placeholderProject = addClip(placeholderProject, {
          id: clipId,
          trackId,
          assetId,
          kind: "audio",
          start: prevCurrentTime,
          end: prevCurrentTime + PLACEHOLDER_DURATION,
        });
      } else {
        const { width: canvasW, height: canvasH } = get().preferredCanvasSize;
        placeholderProject = createEmptyProject({
          id: createId("project"),
          name: file.name,
          fps: 30,
          width: canvasW,
          height: canvasH,
          exportSettings: { format: "mp4" },
        });
        placeholderProject = {
          ...placeholderProject,
          assets: [placeholderAsset],
        };
        placeholderProject = addTrack(placeholderProject, {
          id: trackId,
          kind: "audio",
          name: "音频",
          order: 0,
          muted: false,
          hidden: false,
          locked: false,
        });
        placeholderProject = addClip(placeholderProject, {
          id: clipId,
          trackId,
          assetId,
          kind: "audio",
          start: prevCurrentTime,
          end: prevCurrentTime + PLACEHOLDER_DURATION,
        });
      }

      set({
        project: placeholderProject,
        duration: getProjectDuration(placeholderProject),
        currentTime: get().currentTime,
        isPlaying: false,
      });

      // --- 第二步：异步探测媒体信息，完成后更新 asset 和 clip ---
      try {
        const info = await probeMedia({ type: "blob", blob: file });

        if (!info.audio) {
          throw new Error("该文件不包含音频轨道");
        }

        const audioDuration = info.duration;
        if (audioDuration <= 0) {
          throw new Error("音频时长为 0");
        }

        const current = get().project;
        if (!current) return;

        const finalAsset: Asset = {
          ...placeholderAsset,
          duration: audioDuration,
          loading: false,
          audioMeta: {
            sampleRate: info.audio.sampleRate,
            channels: info.audio.numberOfChannels,
            codec: info.audio.codec ?? undefined,
          },
        };

        const clipStart = existing ? prevCurrentTime : 0;
        let project: Project = {
          ...current,
          assets: current.assets.map((a) =>
            a.id === assetId ? finalAsset : a
          ),
        };
        project = updateClip(project, clipId, {
          start: clipStart,
          end: clipStart + audioDuration,
          inPoint: 0,
          outPoint: audioDuration,
        });

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
              mediaUrl,
              project
            )
          );
        }
      } catch {
        const current = get().project;
        if (current) {
          let project = removeClip(current, clipId);
          project = {
            ...project,
            tracks: project.tracks.filter((t) => t.id !== trackId),
            assets: project.assets.filter((a) => a.id !== assetId),
          };
          const duration = getProjectDuration(project);
          const hasContent = project.tracks.length > 0;
          set({
            project: hasContent ? project : prevProject,
            duration: hasContent ? duration : prevDuration,
            currentTime: hasContent
              ? Math.min(get().currentTime, duration)
              : prevCurrentTime,
          });
        }
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
          createSetCanvasBackgroundColorCommand(set, prevColor, color)
        );
      }
    },

    setTimelineSnapEnabled(_enabled: boolean) {
      // 当前版本：时间轴吸附始终开启，UI 不再修改该值
      set({ timelineSnapEnabled: true });
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
              height
            )
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
          c.id === clipId ? [leftClip, rightClip] : [c]
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
        createCutClipCommand(get, set, clip, leftClip, rightClip)
      );
    },

    /**
     * 向左裁剪：将 clip 的 start 推进到 currentTime，并同步 inPoint（保持画面内容不变）。
     */
    trimClipLeft(clipId: string) {
      const project = get().project;
      if (!project) return;
      const currentTime = get().currentTime;
      const clip = findClipById(project, clipId as Clip["id"]);
      if (!clip) return;
      if (currentTime <= clip.start || currentTime >= clip.end) return;

      const inPoint = clip.inPoint ?? 0;
      const nextStart = currentTime;
      const nextInPoint = inPoint + (currentTime - clip.start);

      const cmd = createTrimClipLeftCommand(
        () => ({ project: get().project, currentTime: get().currentTime }),
        (partial) => set(partial),
        clip,
        currentTime,
        nextStart,
        nextInPoint
      );
      cmd.execute();
      get().pushHistory(cmd);
    },

    /**
     * 向右裁剪：将 clip 的 end 收缩到 currentTime，并同步 outPoint。
     */
    trimClipRight(clipId: string) {
      const project = get().project;
      if (!project) return;
      const currentTime = get().currentTime;
      const clip = findClipById(project, clipId as Clip["id"]);
      if (!clip) return;
      if (currentTime <= clip.start || currentTime >= clip.end) return;

      const inPoint = clip.inPoint ?? 0;
      const asset = project.assets.find((a) => a.id === clip.assetId);
      const assetDuration = asset?.duration ?? clip.end - clip.start;
      const prevOutPoint = clip.outPoint ?? assetDuration;
      const nextEnd = currentTime;
      const nextOutPoint =
        inPoint + (currentTime - clip.start) > prevOutPoint
          ? prevOutPoint
          : inPoint + (currentTime - clip.start);

      const cmd = createTrimClipRightCommand(
        () => ({ project: get().project, currentTime: get().currentTime }),
        (partial) => set(partial),
        clip,
        currentTime,
        nextEnd,
        nextOutPoint
      );
      cmd.execute();
      get().pushHistory(cmd);
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

    addMediaPlaceholder({
      name,
      kind,
      sourceUrl,
    }: {
      name: string;
      kind: "video" | "audio" | "image";
      sourceUrl?: string;
    }) {
      const PLACEHOLDER_DURATION = 5;
      const currentTime = get().currentTime;
      const assetId = createId("asset");
      const trackId = createId("track");
      const clipId = createId("clip");

      const placeholderAsset: Asset = {
        id: assetId,
        name,
        source: sourceUrl ?? "",
        kind,
        duration: PLACEHOLDER_DURATION,
        loading: true,
      };

      const existing = get().project;
      let project: Project;

      if (existing) {
        project = {
          ...existing,
          assets: [...existing.assets, placeholderAsset],
        };
        const topOrder =
          Math.max(...project.tracks.map((t) => t.order), -1) + 1;
        project = addTrack(project, {
          id: trackId,
          kind: kind === "audio" ? "audio" : "video",
          name,
          order: topOrder,
          muted: false,
          hidden: false,
          locked: false,
        });
        project = addClip(project, {
          id: clipId,
          trackId,
          assetId,
          kind,
          start: currentTime,
          end: currentTime + PLACEHOLDER_DURATION,
          ...(kind !== "audio" ? { transform: { x: 0, y: 0 } } : {}),
        });
      } else {
        const { width, height } = get().preferredCanvasSize;
        project = createEmptyProject({
          id: createId("project"),
          name,
          fps: 30,
          width,
          height,
          exportSettings: { format: "mp4" },
        });
        project = { ...project, assets: [placeholderAsset] };
        project = addTrack(project, {
          id: trackId,
          kind: kind === "audio" ? "audio" : "video",
          name,
          order: 0,
          muted: false,
          hidden: false,
          locked: false,
        });
        project = addClip(project, {
          id: clipId,
          trackId,
          assetId,
          kind,
          start: 0,
          end: PLACEHOLDER_DURATION,
          ...(kind !== "audio" ? { transform: { x: 0, y: 0 } } : {}),
        });
      }

      set({
        project,
        duration: getProjectDuration(project),
        currentTime: get().currentTime,
        isPlaying: false,
      });

      return { assetId, trackId, clipId };
    },

    async resolveMediaPlaceholder(
      ids: { assetId: string; trackId: string; clipId: string },
      fileOrUrl: File | string | null,
      options?: { skipHistory?: boolean }
    ) {
      const { assetId, trackId, clipId } = ids;

      if (fileOrUrl === null || fileOrUrl === undefined) {
        // 失败：回滚占位
        const current = get().project;
        if (!current) return;
        let project = removeClip(current, clipId);
        project = {
          ...project,
          tracks: project.tracks.filter((t) => t.id !== trackId),
          assets: project.assets.filter((a) => a.id !== assetId),
        };
        const duration = getProjectDuration(project);
        set({
          project: project.tracks.length > 0 ? project : null,
          duration: project.tracks.length > 0 ? duration : 0,
          currentTime:
            project.tracks.length > 0
              ? Math.min(get().currentTime, duration)
              : 0,
        });
        return;
      }

      const current = get().project;
      if (!current) return;
      const placeholderAsset = current.assets.find((a) => a.id === assetId);
      if (!placeholderAsset) return;

      const kind = placeholderAsset.kind;
      const isExistingUrl = typeof fileOrUrl === "string";
      let mediaUrl: string;

      if (isExistingUrl) {
        mediaUrl = fileOrUrl;
      } else {
        try {
          const { url } = await uploadFileToMedia(fileOrUrl);
          mediaUrl = url;
        } catch (err) {
          console.error("Upload failed:", err);
          const proj = get().project;
          if (!proj) return;
          let project = removeClip(proj, clipId);
          project = {
            ...project,
            tracks: project.tracks.filter((t) => t.id !== trackId),
            assets: project.assets.filter((a) => a.id !== assetId),
          };
          set({
            project: project.tracks.length > 0 ? project : null,
            duration:
              project.tracks.length > 0 ? getProjectDuration(project) : 0,
          });
          return;
        }
      }

      const probeSource = isExistingUrl
        ? { type: "url" as const, url: mediaUrl }
        : { type: "blob" as const, blob: fileOrUrl };

      try {
        if (kind === "video") {
          const info = await probeMedia(probeSource);
          const proj = get().project;
          if (!proj) return;

          const finalAsset: Asset = {
            ...placeholderAsset,
            source: mediaUrl,
            duration: info.duration,
            loading: false,
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

          const clip = findClipById(proj, clipId);
          const clipStart = clip?.start ?? 0;
          let project: Project = {
            ...proj,
            assets: proj.assets.map((a) => (a.id === assetId ? finalAsset : a)),
          };
          project = updateClip(project, clipId, {
            start: clipStart,
            end: clipStart + info.duration,
            inPoint: 0,
            outPoint: info.duration,
          });
          const prevVideoUrl = get().videoUrl;
          set({
            project,
            duration: getProjectDuration(project),
            videoUrl: mediaUrl,
          });
          if (!options?.skipHistory) {
            get().pushHistory(
              createResolvePlaceholderCommand(get, set, {
                kind: "video",
                resolvedProject: project,
                assetId,
                trackId,
                clipId,
                prevVideoUrl,
              })
            );
          }
        } else if (kind === "audio") {
          const info = await probeMedia(probeSource);
          if (!info.audio || info.duration <= 0) {
            throw new Error("无效音频");
          }
          const proj = get().project;
          if (!proj) return;

          const finalAsset: Asset = {
            ...placeholderAsset,
            source: mediaUrl,
            duration: info.duration,
            loading: false,
            audioMeta: {
              sampleRate: info.audio.sampleRate,
              channels: info.audio.numberOfChannels,
              codec: info.audio.codec ?? undefined,
            },
          };

          const clip = findClipById(proj, clipId);
          const clipStart = clip?.start ?? 0;
          let project: Project = {
            ...proj,
            assets: proj.assets.map((a) => (a.id === assetId ? finalAsset : a)),
          };
          project = updateClip(project, clipId, {
            start: clipStart,
            end: clipStart + info.duration,
            inPoint: 0,
            outPoint: info.duration,
          });
          set({ project, duration: getProjectDuration(project) });
          if (!options?.skipHistory) {
            get().pushHistory(
              createResolvePlaceholderCommand(get, set, {
                kind: "audio",
                resolvedProject: project,
                assetId,
                trackId,
                clipId,
                prevVideoUrl: null,
              })
            );
          }
        } else {
          // image
          const dims = await getImageDimensions(mediaUrl);
          const proj = get().project;
          if (!proj) return;

          const stageW = proj.width;
          const stageH = proj.height;
          const containScale = Math.min(
            stageW / Math.max(1, dims.width),
            stageH / Math.max(1, dims.height)
          );
          const displayW = dims.width * containScale;
          const displayH = dims.height * containScale;

          const finalAsset: Asset = {
            ...placeholderAsset,
            source: mediaUrl,
            loading: false,
            imageMeta: { width: dims.width, height: dims.height },
          };

          let project: Project = {
            ...proj,
            assets: proj.assets.map((a) => (a.id === assetId ? finalAsset : a)),
          };
          project = updateClip(project, clipId, {
            transform: {
              x: (stageW - displayW) / 2,
              y: (stageH - displayH) / 2,
              scaleX: displayW / Math.max(1, stageW),
              scaleY: displayH / Math.max(1, stageH),
            },
          });
          set({ project, duration: getProjectDuration(project) });
          if (!options?.skipHistory) {
            get().pushHistory(
              createResolvePlaceholderCommand(get, set, {
                kind: "image",
                resolvedProject: project,
                assetId,
                trackId,
                clipId,
                prevVideoUrl: null,
              })
            );
          }
        }
      } catch {
        // 解析失败：回滚
        const proj = get().project;
        if (!proj) return;
        let project = removeClip(proj, clipId);
        project = {
          ...project,
          tracks: project.tracks.filter((t) => t.id !== trackId),
          assets: project.assets.filter((a) => a.id !== assetId),
        };
        const duration = getProjectDuration(project);
        set({
          project: project.tracks.length > 0 ? project : null,
          duration: project.tracks.length > 0 ? duration : 0,
          currentTime:
            project.tracks.length > 0
              ? Math.min(get().currentTime, duration)
              : 0,
        });
      }
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
          assetId
        )
      );
    },

    /**
     * 在播放头位置添加形状片段。
     * 形状以 SVG data URL 作为图片 source，复用图片渲染管线。
     */
    addShapeClip(
      svgDataUrl: string,
      shapeSize: { width: number; height: number },
      name = "形状"
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
          assetId
        )
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
      trackId?: string
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

      // clip 在 resize（时长变化）时同步更新 inPoint/outPoint
      // - 左侧 resize：仅调整 inPoint，使播放起点与 start 对齐
      // - 右侧 resize：仅调整 outPoint，使播放终点与 end 对齐
      let patchInPoint: number | undefined;
      let patchOutPoint: number | undefined;
      let prevInPointForHistory: number | undefined;
      let prevOutPointForHistory: number | undefined;
      const prevDuration = prevEnd - prevStart;
      const nextDuration = constrainedEnd - constrainedStart;
      if (clipBefore && Math.abs(prevDuration - nextDuration) > 1e-6) {
        const asset = project.assets.find((a) => a.id === clipBefore.assetId);
        const assetDuration = asset?.duration ?? prevEnd - prevStart;
        const prevInPoint = clipBefore.inPoint ?? 0;
        const prevOutPoint = clipBefore.outPoint ?? assetDuration;
        const deltaStart = constrainedStart - prevStart;
        const deltaEnd = constrainedEnd - prevEnd;
        const rawIn = prevInPoint + deltaStart;
        const rawOut = prevOutPoint + deltaEnd;
        const nextInPoint = Math.max(0, Math.min(assetDuration, rawIn));
        const nextOutPoint = Math.max(
          nextInPoint + 0.001,
          Math.min(assetDuration, rawOut)
        );
        patchInPoint = nextInPoint;
        patchOutPoint = nextOutPoint;
        prevInPointForHistory = prevInPoint;
        prevOutPointForHistory = prevOutPoint;
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
          prevInPointForHistory,
          prevOutPointForHistory,
          patchInPoint,
          patchOutPoint
        )
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
        createReorderTracksCommand(get, set, previousOrder, orderedTrackIds)
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
          !track.muted
        )
      );
    },

    /**
     * 切换指定轨道的可见状态（true/false）。
     * 隐藏后在 Preview 中不渲染该轨道内容，在时间轴上整体降不透明度。
     */
    toggleTrackHidden(trackId: string) {
      const project = get().project;
      if (!project) {
        return;
      }
      const track = project.tracks.find((t) => t.id === trackId);
      if (!track) {
        return;
      }
      const previousHidden = track.hidden ?? false;
      const nextHidden = !previousHidden;
      const nextProject: Project = {
        ...project,
        tracks: project.tracks.map((t) =>
          t.id === trackId ? { ...t, hidden: nextHidden } : t
        ),
      };
      set({ project: nextProject });
      get().pushHistory(
        createToggleTrackHiddenCommand(
          get,
          set,
          trackId,
          previousHidden,
          nextHidden
        )
      );
    },

    /**
     * 切换指定轨道的锁定状态（true/false）。
     */
    toggleTrackLocked(trackId: string) {
      const project = get().project;
      if (!project) {
        return;
      }
      const track = project.tracks.find((t) => t.id === trackId);
      if (!track) {
        return;
      }
      const previousLocked = track.locked ?? false;
      const nextLocked = !previousLocked;
      const nextProject: Project = {
        ...project,
        tracks: project.tracks.map((t) =>
          t.id === trackId ? { ...t, locked: nextLocked } : t
        ),
      };
      const selectedClipId = get().selectedClipId;
      const shouldClearSelection =
        nextLocked &&
        selectedClipId &&
        project.tracks.some(
          (t) => t.id === trackId && t.clips.some((c) => c.id === selectedClipId)
        );
      set({
        project: nextProject,
        ...(shouldClearSelection ? { selectedClipId: null } : {}),
      });
      get().pushHistory(
        createToggleTrackLockedCommand(
          get,
          set,
          trackId,
          previousLocked,
          nextLocked
        )
      );
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
      }
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
          newTransform
        )
      );
    },

    /**
     * 瞬时更新 clip 变换（如不透明度），不写入历史。用于调整面板内拖动时的实时预览。
     */
    updateClipTransformTransient(
      clipId: string,
      transform: { opacity?: number }
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
      prevTransform: Record<string, unknown>
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
          nextTransform
        )
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
          mergedParams
        )
      );
    },

    /**
     * 瞬时更新 clip params，不写入历史。用于颜色/不透明度拖动时的实时预览。
     */
    updateClipParamsTransient(
      clipId: string,
      nextParams: Record<string, unknown>
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
      prevParams: Record<string, unknown>
    ) {
      const project = get().project;
      if (!project) return;
      const clip = findClipById(project, clipId as Clip["id"]);
      if (!clip) return;
      const nextParams = clip.params ?? {};
      get().pushHistory(
        createUpdateClipParamsCommand(get, set, clipId, prevParams, nextParams)
      );
    },
  }))
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
  { equalityFn: shallow }
);
