import { create } from "zustand";
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
} from "@swiftav/project";
import { probeMedia } from "@swiftav/media";
import { renderVideoWithCanvasLoop } from "@swiftav/renderer";
import { createId } from "@swiftav/utils";
import type { ProjectStore } from "./projectStore.types";

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
export const useProjectStore = create<ProjectStore>((set, get) => ({
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
  async loadVideoFile(file: File) {
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
        const clip: Clip = {
          id: clipId,
          trackId,
          assetId,
          kind: "video",
          // 初始片段默认铺满整个素材时长，从时间 0 开始
          start: 0,
          end: info.duration,
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
        // 工程宽高优先取媒体的显示宽高；取不到则用 1920x1080 兜底
        const width = info.video?.displayWidth ?? 1920;
        const height = info.video?.displayHeight ?? 1080;

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
  setCanvasBackgroundColor(color: string) {
    set({ canvasBackgroundColor: color });
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
      track.clips.length === 0 ? 0 : Math.max(...track.clips.map((c) => c.end));
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
  },

  /**
   * 从工程中删除指定 clip，并重新计算 duration、回退越界的 currentTime。
   */
  deleteClip(clipId: string) {
    const project = get().project;
    if (!project) return;
    const nextProject = removeClip(project, clipId as Clip["id"]);
    const duration = getProjectDuration(nextProject);
    const currentTime = Math.min(get().currentTime, duration);
    set({
      project: nextProject,
      duration,
      currentTime,
    });
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

    const effectiveTrackId =
      trackId ?? findClipById(project, clipId)?.trackId;
    const track = effectiveTrackId
      ? project.tracks.find((t) => t.id === effectiveTrackId)
      : undefined;
    const others = track
      ? track.clips.filter((c) => c.id !== clipId)
      : [];
    const { start: constrainedStart, end: constrainedEnd } =
      constrainClipNoOverlap(others, clipId, start, end);

    // 用 @swiftav/project 的纯函数更新 clip；必要时同时更新归属轨道
    const nextProject = updateClip(project, clipId, {
      start: constrainedStart,
      end: constrainedEnd,
      ...(trackId ? { trackId } : {}),
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
  },

  reorderTracks(orderedTrackIds: string[]) {
    const project = get().project;
    if (!project || orderedTrackIds.length === 0) {
      return;
    }
    const nextProject = reorderTracksProject(project, orderedTrackIds);
    set({ project: nextProject });
  },

  toggleTrackMuted(trackId: string) {
    const project = get().project;
    if (!project) {
      return;
    }
    const track = project.tracks.find((t) => t.id === trackId);
    if (!track) {
      return;
    }
    const nextProject = setTrackMuted(project, trackId, !track.muted);
    set({ project: nextProject });
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
}));
