/**
 * 工程编辑的撤销/重做命令（增量数据，不存整份 project）。
 *
 * 每个命令只存 undo/redo 所需的最小数据，redo 时用纯函数重算，避免闭包整份 nextProject。
 */
import type { Command } from "@swiftav/history";
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
} from "@swiftav/project";

type GetState = () => { project: Project | null; currentTime: number };
type SetState = (partial: Record<string, unknown>) => void;

const syncDurationAndCurrentTime = (
	set: SetState,
	project: Project,
	get: GetState,
) => {
	const duration = getProjectDuration(project);
	const currentTime = Math.min(get().currentTime, duration);
	set({ project, duration, currentTime });
};

/** updateClipTiming：存「新」的 start/end/trackId，redo 时重算；undo 用 prev 打回 */
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
): Command {
	return {
		execute: () => {
			const p = get().project;
			if (!p) return;
			const next = updateClip(p, clipId as Clip["id"], {
				start: nextStart,
				end: nextEnd,
				...(nextTrackId !== undefined ? { trackId: nextTrackId } : {}),
			});
			syncDurationAndCurrentTime(set, next, get);
		},
		undo: () => {
			const p = get().project;
			if (!p) return;
			const prev = updateClip(p, clipId as Clip["id"], {
				start: prevStart,
				end: prevEnd,
				...(prevTrackId !== undefined ? { trackId: prevTrackId } : {}),
			});
			syncDurationAndCurrentTime(set, prev, get);
		},
	};
}

/** duplicateClip：存新 clip，undo 删掉、redo 再加回 */
export function createDuplicateClipCommand(
	get: GetState,
	set: SetState,
	newClip: Clip,
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
	nextCurrentTime: number,
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
	rightClip: Clip,
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

/** reorderTracks：存「新」顺序，redo 重算、undo 用 previousOrder 重算 */
export function createReorderTracksCommand(
	get: GetState,
	set: SetState,
	previousOrder: string[],
	orderedTrackIds: string[],
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
	nextMuted: boolean,
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
	addedProject: Project,
): Command {
	const blobUrlRef = { current: addedBlobUrl };

	const isAppend = prev.prevProject !== null;
	const addedAsset: Asset | undefined = isAppend
		? addedProject.assets.find((a) => a.source === addedBlobUrl)
		: undefined;
	const addedTrack: Track | undefined =
		isAppend && prev.prevProject
			? addedProject.tracks.find(
					(t) => !prev.prevProject!.tracks.some((pt) => pt.id === t.id),
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
					{ ...addedTrack, clips: addedTrack.clips },
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
						a.source === addedBlobUrl ? { ...a, source: newBlobUrl } : a,
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

/** 设置画布背景色：存前后颜色，undo/redo 对调 */
export function createSetCanvasBackgroundColorCommand(
	set: SetState,
	prevColor: string,
	nextColor: string,
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

/** updateClipTransform：存前后 transform，undo/redo 对调 */
export function createUpdateClipTransformCommand(
	get: GetState,
	set: SetState,
	clipId: string,
	prevTransform: ClipTransform | undefined,
	nextTransform: ClipTransform,
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
