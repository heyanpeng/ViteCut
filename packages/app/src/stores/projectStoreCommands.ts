/**
 * 工程编辑的撤销/重做命令（增量数据，不存整份 project）。
 *
 * 每个命令只存 undo/redo 所需的最小数据，redo 时用纯函数重算，避免闭包整份 nextProject。
 */
import type { Command } from "@vitecut/history";
import {
  type Project,
  type Asset,
  type Track,
  type Clip,
  type ClipTransform,
  updateClip,
  getProjectDuration,
  removeClip,
  addClip,
  addTrack,
  reorderTracks as reorderTracksProject,
  setTrackMuted,
} from "@vitecut/project";

type GetState = () => { project: Project | null; currentTime: number };
type SetState = (partial: Record<string, unknown>) => void;

const syncDurationAndCurrentTime = (
  set: SetState,
  project: Project,
  get: GetState
) => {
  const duration = getProjectDuration(project);
  const currentTime = Math.min(get().currentTime, duration);
  set({ project, duration, currentTime });
};

/** updateClipTiming：存「新」的 start/end/trackId（及可选的 inPoint/outPoint），redo 时重算；undo 用 prev 打回 */
export function createUpdateClipTimingCommand(
  get: GetState,
  set: SetState,
  clipId: string,
  prevStart: number,
  prevEnd: number,
  prevTrackId: string | undefined,
  nextStart: number,
  nextEnd: number,
  nextTrackId: string | undefined,
  prevInPoint?: number,
  prevOutPoint?: number,
  nextInPoint?: number,
  nextOutPoint?: number
): Command {
  return {
    execute: () => {
      const p = get().project;
      if (!p) return;
      const patch: Parameters<typeof updateClip>[2] = {
        start: nextStart,
        end: nextEnd,
        ...(nextTrackId !== undefined ? { trackId: nextTrackId } : {}),
        ...(nextInPoint !== undefined ? { inPoint: nextInPoint } : {}),
        ...(nextOutPoint !== undefined ? { outPoint: nextOutPoint } : {}),
      };
      const next = updateClip(p, clipId as Clip["id"], patch);
      syncDurationAndCurrentTime(set, next, get);
    },
    undo: () => {
      const p = get().project;
      if (!p) return;
      const patch: Parameters<typeof updateClip>[2] = {
        start: prevStart,
        end: prevEnd,
        ...(prevTrackId !== undefined ? { trackId: prevTrackId } : {}),
        ...(prevInPoint !== undefined ? { inPoint: prevInPoint } : {}),
        ...(prevOutPoint !== undefined ? { outPoint: prevOutPoint } : {}),
      };
      const prev = updateClip(p, clipId as Clip["id"], patch);
      syncDurationAndCurrentTime(set, prev, get);
    },
  };
}

/** duplicateClip：存新 clip，undo 删掉、redo 再加回 */
export function createDuplicateClipCommand(
  get: GetState,
  set: SetState,
  newClip: Clip
): Command {
  return {
    execute: () => {
      const p = get().project;
      if (!p) return;
      const next = addClip(p, newClip);
      syncDurationAndCurrentTime(set, next, get);
    },
    undo: () => {
      const p = get().project;
      if (!p) return;
      const prev = removeClip(p, newClip.id);
      syncDurationAndCurrentTime(set, prev, get);
    },
  };
}

/** deleteClip：存被删的 clip，undo 插回；redo 再删一次 */
export function createDeleteClipCommand(
  get: GetState,
  set: SetState,
  clip: Clip,
  nextCurrentTime: number
): Command {
  return {
    execute: () => {
      const p = get().project;
      if (!p) return;
      const next = removeClip(p, clip.id);
      const duration = getProjectDuration(next);
      const currentTime = Math.min(nextCurrentTime, duration);
      set({ project: next, duration, currentTime });
    },
    undo: () => {
      const p = get().project;
      if (!p) return;
      const prev = addClip(p, clip);
      syncDurationAndCurrentTime(set, prev, get);
    },
  };
}

/** cutClip：存原 clip 与切出的两段，undo 恢复原 clip，redo 再切成两段 */
export function createCutClipCommand(
  get: GetState,
  set: SetState,
  originalClip: Clip,
  leftClip: Clip,
  rightClip: Clip
): Command {
  return {
    execute: () => {
      let p = get().project;
      if (!p) return;
      p = removeClip(p, originalClip.id);
      p = addClip(p, leftClip);
      p = addClip(p, rightClip);
      syncDurationAndCurrentTime(set, p, get);
    },
    undo: () => {
      let p = get().project;
      if (!p) return;
      p = removeClip(p, leftClip.id);
      p = removeClip(p, rightClip.id);
      p = addClip(p, originalClip);
      syncDurationAndCurrentTime(set, p, get);
    },
  };
}

/** trimClipLeft：向左裁剪，存原时序与裁剪后的时序，undo/redo 调整 start/inPoint */
export function createTrimClipLeftCommand(
  get: GetState,
  set: SetState,
  clip: Clip,
  currentTime: number,
  nextStart: number,
  nextInPoint: number
): Command {
  const prevStart = clip.start;
  const prevInPoint = clip.inPoint ?? 0;
  return createUpdateClipTimingCommand(
    get,
    set,
    clip.id,
    prevStart,
    clip.end,
    clip.trackId,
    nextStart,
    clip.end,
    clip.trackId,
    prevInPoint,
    clip.outPoint,
    nextInPoint,
    clip.outPoint
  );
}

/** trimClipRight：向右裁剪，存原时序与裁剪后的时序，undo/redo 调整 end/outPoint */
export function createTrimClipRightCommand(
  get: GetState,
  set: SetState,
  clip: Clip,
  currentTime: number,
  nextEnd: number,
  nextOutPoint: number
): Command {
  const prevEnd = clip.end;
  const prevOutPoint =
    clip.outPoint ?? (clip.inPoint ?? 0) + (clip.end - clip.start);
  return createUpdateClipTimingCommand(
    get,
    set,
    clip.id,
    clip.start,
    prevEnd,
    clip.trackId,
    clip.start,
    nextEnd,
    clip.trackId,
    clip.inPoint,
    prevOutPoint,
    clip.inPoint,
    nextOutPoint
  );
}

/** reorderTracks：存「新」顺序，redo 重算、undo 用 previousOrder 重算 */
export function createReorderTracksCommand(
  get: GetState,
  set: SetState,
  previousOrder: string[],
  orderedTrackIds: string[]
): Command {
  return {
    execute: () => {
      const p = get().project;
      if (!p) return;
      const next = reorderTracksProject(p, orderedTrackIds);
      syncDurationAndCurrentTime(set, next, get);
    },
    undo: () => {
      const p = get().project;
      if (!p) return;
      const prev = reorderTracksProject(p, previousOrder);
      syncDurationAndCurrentTime(set, prev, get);
    },
  };
}

/** toggleTrackMuted：存 trackId 与切换后的 muted，redo/undo 对调 */
export function createToggleTrackMutedCommand(
  get: GetState,
  set: SetState,
  trackId: string,
  previousMuted: boolean,
  nextMuted: boolean
): Command {
  return {
    execute: () => {
      const p = get().project;
      if (!p) return;
      const next = setTrackMuted(p, trackId, nextMuted);
      syncDurationAndCurrentTime(set, next, get);
    },
    undo: () => {
      const p = get().project;
      if (!p) return;
      const prev = setTrackMuted(p, trackId, previousMuted);
      syncDurationAndCurrentTime(set, prev, get);
    },
  };
}

/** 添加视频（新建工程或追加轨道/clip）：undo 恢复添加前状态并 revoke blob；redo 恢复存下的 project 以保持 ID 不变，后续 UpdateClipTransform 等命令才能生效 */
export type LoadVideoPrevState = {
  prevProject: Project | null;
  prevVideoUrl: string | null;
  prevDuration: number;
  prevCurrentTime: number;
};

type GetStateWithLoadVideo = () => ReturnType<GetState> & {
  loadVideoFile(file: File, options?: { skipHistory?: boolean }): Promise<void>;
};

export function createLoadVideoCommand(
  get: GetStateWithLoadVideo,
  set: SetState,
  file: File,
  prev: LoadVideoPrevState,
  addedBlobUrl: string,
  /** redo 时恢复的 project（含 clip/track/asset 的原始 ID），需替换 blob URL */
  addedProject: Project
): Command {
  const blobUrlRef = { current: addedBlobUrl };

  const isAppend = prev.prevProject !== null;
  const addedAsset: Asset | undefined = isAppend
    ? addedProject.assets.find((a) => a.source === addedBlobUrl)
    : undefined;
  const addedTrack: Track | undefined =
    isAppend && prev.prevProject
      ? addedProject.tracks.find(
          (t) => !prev.prevProject!.tracks.some((pt) => pt.id === t.id)
        )
      : undefined;

  return {
    execute: () => {
      const newBlobUrl = URL.createObjectURL(file);
      blobUrlRef.current = newBlobUrl;

      if (isAppend && addedAsset && addedTrack) {
        const p = get().project;
        if (!p) return;
        const newAsset: Asset = { ...addedAsset, source: newBlobUrl };
        const nextProject = addTrack(
          { ...p, assets: [...p.assets, newAsset] },
          { ...addedTrack, clips: addedTrack.clips }
        );
        const duration = getProjectDuration(nextProject);
        set({
          project: nextProject,
          videoUrl: newBlobUrl,
          duration,
          currentTime: Math.min(get().currentTime, duration),
          isPlaying: false,
        });
      } else {
        const projectRestored: Project = {
          ...addedProject,
          assets: addedProject.assets.map((a) =>
            a.source === addedBlobUrl ? { ...a, source: newBlobUrl } : a
          ),
        };
        const duration = getProjectDuration(projectRestored);
        set({
          project: projectRestored,
          videoUrl: newBlobUrl,
          duration,
          currentTime: Math.min(get().currentTime, duration),
          isPlaying: false,
        });
      }
    },
    undo: () => {
      URL.revokeObjectURL(blobUrlRef.current);
      if (prev.prevProject === null) {
        set({
          project: null,
          videoUrl: prev.prevVideoUrl,
          duration: 0,
          currentTime: 0,
        });
      } else {
        const duration = getProjectDuration(prev.prevProject);
        const currentTime = Math.min(prev.prevCurrentTime, duration);
        set({
          project: prev.prevProject,
          videoUrl: prev.prevVideoUrl,
          duration,
          currentTime,
        });
      }
    },
  };
}

/** 添加图片：与 createLoadVideoCommand 类似，但不修改 videoUrl */
export type LoadImagePrevState = {
  prevProject: Project | null;
  prevDuration: number;
  prevCurrentTime: number;
};

type GetStateWithLoadImage = () => ReturnType<GetState> & {
  loadImageFile(file: File, options?: { skipHistory?: boolean }): Promise<void>;
};

export function createLoadImageCommand(
  get: GetStateWithLoadImage,
  set: SetState,
  file: File,
  prev: LoadImagePrevState,
  addedBlobUrl: string,
  addedProject: Project
): Command {
  const blobUrlRef = { current: addedBlobUrl };
  const isAppend = prev.prevProject !== null;
  const addedAsset: Asset | undefined = isAppend
    ? addedProject.assets.find((a) => a.source === addedBlobUrl)
    : undefined;
  const addedTrack: Track | undefined =
    isAppend && prev.prevProject
      ? addedProject.tracks.find(
          (t) => !prev.prevProject!.tracks.some((pt) => pt.id === t.id)
        )
      : undefined;

  return {
    execute: () => {
      const newBlobUrl = URL.createObjectURL(file);
      blobUrlRef.current = newBlobUrl;
      if (isAppend && addedAsset && addedTrack) {
        const p = get().project;
        if (!p) return;
        const newAsset: Asset = { ...addedAsset, source: newBlobUrl };
        const nextProject = addTrack(
          { ...p, assets: [...p.assets, newAsset] },
          { ...addedTrack, clips: addedTrack.clips }
        );
        const duration = getProjectDuration(nextProject);
        set({
          project: nextProject,
          duration,
          currentTime: Math.min(get().currentTime, duration),
          isPlaying: false,
        });
      } else {
        const projectRestored: Project = {
          ...addedProject,
          assets: addedProject.assets.map((a) =>
            a.source === addedBlobUrl ? { ...a, source: newBlobUrl } : a
          ),
        };
        const duration = getProjectDuration(projectRestored);
        set({
          project: projectRestored,
          duration,
          currentTime: Math.min(get().currentTime, duration),
          isPlaying: false,
        });
      }
    },
    undo: () => {
      URL.revokeObjectURL(blobUrlRef.current);
      if (prev.prevProject === null) {
        set({
          project: null,
          duration: 0,
          currentTime: 0,
        });
      } else {
        const duration = getProjectDuration(prev.prevProject);
        const currentTime = Math.min(prev.prevCurrentTime, duration);
        set({
          project: prev.prevProject,
          duration,
          currentTime,
        });
      }
    },
  };
}

/** 添加音频：与 createLoadImageCommand 类似，但不修改 videoUrl，track.kind 为 "audio" */
export type LoadAudioPrevState = {
  prevProject: Project | null;
  prevDuration: number;
  prevCurrentTime: number;
};

type GetStateWithLoadAudio = () => ReturnType<GetState> & {
  loadAudioFile(file: File, options?: { skipHistory?: boolean }): Promise<void>;
};

export function createLoadAudioCommand(
  get: GetStateWithLoadAudio,
  set: SetState,
  file: File,
  prev: LoadAudioPrevState,
  addedBlobUrl: string,
  addedProject: Project
): Command {
  const blobUrlRef = { current: addedBlobUrl };
  const isAppend = prev.prevProject !== null;
  const addedAsset: Asset | undefined = isAppend
    ? addedProject.assets.find((a) => a.source === addedBlobUrl)
    : undefined;
  const addedTrack: Track | undefined =
    isAppend && prev.prevProject
      ? addedProject.tracks.find(
          (t) => !prev.prevProject!.tracks.some((pt) => pt.id === t.id)
        )
      : undefined;

  return {
    execute: () => {
      const newBlobUrl = URL.createObjectURL(file);
      blobUrlRef.current = newBlobUrl;
      if (isAppend && addedAsset && addedTrack) {
        const p = get().project;
        if (!p) return;
        const newAsset: Asset = { ...addedAsset, source: newBlobUrl };
        const nextProject = addTrack(
          { ...p, assets: [...p.assets, newAsset] },
          { ...addedTrack, clips: addedTrack.clips }
        );
        const duration = getProjectDuration(nextProject);
        set({
          project: nextProject,
          duration,
          currentTime: Math.min(get().currentTime, duration),
          isPlaying: false,
        });
      } else {
        const projectRestored: Project = {
          ...addedProject,
          assets: addedProject.assets.map((a) =>
            a.source === addedBlobUrl ? { ...a, source: newBlobUrl } : a
          ),
        };
        const duration = getProjectDuration(projectRestored);
        set({
          project: projectRestored,
          duration,
          currentTime: Math.min(get().currentTime, duration),
          isPlaying: false,
        });
      }
    },
    undo: () => {
      URL.revokeObjectURL(blobUrlRef.current);
      if (prev.prevProject === null) {
        set({
          project: null,
          duration: 0,
          currentTime: 0,
        });
      } else {
        const duration = getProjectDuration(prev.prevProject);
        const currentTime = Math.min(prev.prevCurrentTime, duration);
        set({
          project: prev.prevProject,
          duration,
          currentTime,
        });
      }
    },
  };
}

/** 解析占位媒体（resolveMediaPlaceholder）的撤销/重做：undo 直接删除该媒体（clip/track/asset）并 revoke blob，redo 用 file 重建 blob 并恢复 */
export type ResolvePlaceholderParams = {
  kind: "video" | "image" | "audio";
  file: File;
  resolvedProject: Project;
  assetId: string;
  trackId: string;
  clipId: string;
  /** 仅 kind === "video" 时使用，undo 删除后恢复 */
  prevVideoUrl: string | null;
};

export function createResolvePlaceholderCommand(
  get: GetState,
  set: SetState,
  params: ResolvePlaceholderParams
): Command {
  const {
    kind,
    file,
    resolvedProject,
    assetId,
    trackId,
    clipId,
    prevVideoUrl,
  } = params;
  const addedAsset = resolvedProject.assets.find((a) => a.id === assetId);
  const blobUrlRef = { current: addedAsset?.source ?? "" };

  return {
    execute: () => {
      const newBlobUrl = URL.createObjectURL(file);
      blobUrlRef.current = newBlobUrl;
      const newProject: Project = {
        ...resolvedProject,
        assets: resolvedProject.assets.map((a) =>
          a.id === assetId ? { ...a, source: newBlobUrl } : a
        ),
      };
      const duration = getProjectDuration(newProject);
      const currentTime = Math.min(get().currentTime, duration);
      set({
        project: newProject,
        duration,
        currentTime,
        isPlaying: false,
        ...(kind === "video" ? { videoUrl: newBlobUrl } : {}),
      });
    },
    undo: () => {
      if (typeof blobUrlRef.current === "string" && blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
      }
      let project = removeClip(resolvedProject, clipId);
      project = {
        ...project,
        tracks: project.tracks.filter((t) => t.id !== trackId),
        assets: project.assets.filter((a) => a.id !== assetId),
      };
      const hasContent = project.tracks.length > 0;
      const duration = hasContent ? getProjectDuration(project) : 0;
      const currentTime = hasContent
        ? Math.min(get().currentTime, duration)
        : 0;
      set({
        project: hasContent ? project : null,
        duration,
        currentTime,
        ...(kind === "video" ? { videoUrl: prevVideoUrl } : {}),
      });
    },
  };
}

/** 设置画布尺寸：存前后 width/height，undo/redo 对调 */
export function createSetCanvasSizeCommand(
  get: GetState,
  set: SetState,
  prevWidth: number,
  prevHeight: number,
  nextWidth: number,
  nextHeight: number
): Command {
  return {
    execute: () => {
      const p = get().project;
      if (!p) return;
      const next = {
        ...p,
        width: nextWidth,
        height: nextHeight,
        updatedAt: new Date().toISOString(),
      };
      set({
        project: next,
        preferredCanvasSize: { width: nextWidth, height: nextHeight },
      });
    },
    undo: () => {
      const p = get().project;
      if (!p) return;
      const prev = {
        ...p,
        width: prevWidth,
        height: prevHeight,
        updatedAt: new Date().toISOString(),
      };
      set({
        project: prev,
        preferredCanvasSize: { width: prevWidth, height: prevHeight },
        preferredCanvasPreset: null,
      });
    },
  };
}

/** 设置画布背景色：存前后颜色，undo/redo 对调 */
export function createSetCanvasBackgroundColorCommand(
  set: SetState,
  prevColor: string,
  nextColor: string
): Command {
  return {
    execute: () => {
      set({ canvasBackgroundColor: nextColor });
    },
    undo: () => {
      set({ canvasBackgroundColor: prevColor });
    },
  };
}

/** 添加文字片段：undo 恢复 prevProject，redo 恢复 nextProject */
export function createAddTextClipCommand(
  get: GetState,
  set: SetState,
  prevProject: Project | null,
  nextProject: Project,
  addedClipId: string,
  _addedTrackId: string,
  _addedAssetId: string
): Command {
  return {
    execute: () => {
      const duration = getProjectDuration(nextProject);
      const currentTime = Math.min(get().currentTime, duration);
      set({
        project: nextProject,
        duration,
        currentTime,
        selectedClipId: addedClipId,
      });
    },
    undo: () => {
      if (prevProject === null) {
        set({
          project: null,
          duration: 0,
          currentTime: 0,
          selectedClipId: null,
        });
      } else {
        const duration = getProjectDuration(prevProject);
        const currentTime = Math.min(get().currentTime, duration);
        set({
          project: prevProject,
          duration,
          currentTime,
          selectedClipId: null,
        });
      }
    },
  };
}

/** updateClipParams：存前后 params，undo/redo 对调（用于文本内容等） */
export function createUpdateClipParamsCommand(
  get: GetState,
  set: SetState,
  clipId: string,
  prevParams: Record<string, unknown> | undefined,
  nextParams: Record<string, unknown>
): Command {
  return {
    execute: () => {
      const p = get().project;
      if (!p) return;
      const next = updateClip(p, clipId as Clip["id"], { params: nextParams });
      set({ project: next });
    },
    undo: () => {
      const p = get().project;
      if (!p) return;
      const prev = updateClip(p, clipId as Clip["id"], { params: prevParams });
      set({ project: prev });
    },
  };
}

/** updateClipTransform：存前后 transform，undo/redo 对调 */
export function createUpdateClipTransformCommand(
  get: GetState,
  set: SetState,
  clipId: string,
  prevTransform: ClipTransform | undefined,
  nextTransform: ClipTransform
): Command {
  return {
    execute: () => {
      const p = get().project;
      if (!p) return;
      const next = updateClip(p, clipId as Clip["id"], {
        transform: nextTransform,
      });
      set({ project: next });
    },
    undo: () => {
      const p = get().project;
      if (!p) return;
      const prev = updateClip(p, clipId as Clip["id"], {
        transform: prevTransform,
      });
      set({ project: prev });
    },
  };
}
