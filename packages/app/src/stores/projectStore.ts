import { create } from "zustand";
import {
  type Project,
  type Asset,
  type Track,
  type Clip,
  createEmptyProject,
  addTrack,
  addClip,
  getProjectDuration,
} from "@swiftav/project";
import { probeMedia } from "@swiftav/media";
import { renderVideoWithCanvasLoop } from "@swiftav/renderer";

/**
 * 工程相关的全局状态。
 */
export interface ProjectStoreState {
  project: Project | null;
  /**
   * 当前预览时间（秒）
   */
  currentTime: number;
  /**
   * 当前工程总时长（秒）
   */
  duration: number;
  /**
   * 是否正在播放（暂时仅用于 UI 显示）
   */
  isPlaying: boolean;
  /**
   * 是否正在执行导入/导出等耗时操作。
   */
  loading: boolean;
  /**
   * 当前主视频资源的 URL（通常由 File 生成的 blob URL）。
   */
  videoUrl: string | null;
}

export interface ProjectStoreActions {
  /**
   * 从本地视频文件创建新的工程。
   */
  loadVideoFile(file: File): Promise<void>;
  /**
   * 更新当前预览时间。
   */
  setCurrentTime(time: number): void;
  /**
   * 更新播放状态。
   */
  setIsPlaying(isPlaying: boolean): void;
  /**
   * 将当前工程导出为 mp4，并返回生成的视频 Blob。
   */
  exportToMp4(onProgress?: (progress: number) => void): Promise<Blob | null>;
}

export type ProjectStore = ProjectStoreState & ProjectStoreActions;

/**
 * 简单的 id 生成工具。
 */
function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  project: null,
  currentTime: 0,
  duration: 0,
  isPlaying: false,
  loading: false,
  videoUrl: null,

  async loadVideoFile(file: File) {
    // 释放上一次的 blob URL
    const prevUrl = get().videoUrl;
    if (prevUrl) {
      URL.revokeObjectURL(prevUrl);
    }

    const blobUrl = URL.createObjectURL(file);

    set({ loading: true });
    try {
      const info = await probeMedia({ type: "blob", blob: file });

      const projectId = createId("project");
      const width = info.video?.displayWidth ?? 1920;
      const height = info.video?.displayHeight ?? 1080;

      let project: Project = createEmptyProject({
        id: projectId,
        name: file.name,
        fps: 30,
        width,
        height,
        exportSettings: {
          format: "mp4",
        },
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

      // 将资源加入工程
      project = {
        ...project,
        assets: [asset],
      };

      const trackId = createId("track");
      const trackBase: Omit<Track, "clips"> = {
        id: trackId,
        kind: "video",
        name: "主视频",
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
        transform: {
          x: 0,
          y: 0,
        },
      };

      project = addClip(project, clip);

      const duration = getProjectDuration(project);

      set({
        project,
        duration,
        currentTime: 0,
        isPlaying: false,
        videoUrl: blobUrl,
      });
    } finally {
      set({ loading: false });
    }
  },

  setCurrentTime(time: number) {
    set({ currentTime: time });
  },

  setIsPlaying(isPlaying: boolean) {
    set({ isPlaying });
  },

  async exportToMp4(onProgress?: (progress: number) => void): Promise<Blob | null> {
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

      await new Promise<void>((resolve, reject) => {
        video.addEventListener("loadedmetadata", () => resolve(), { once: true });
        video.addEventListener("error", () => reject(new Error("视频加载失败")), {
          once: true,
        });
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
}));

