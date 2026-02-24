import {
  useEffect,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from "react";
import type { CanvasEditor } from "@vitecut/canvas";
import type { Project } from "@vitecut/project";
import { findClipById } from "@vitecut/project";
import { AudioBufferSink, CanvasSink } from "mediabunny";
import { createInputFromUrl } from "@vitecut/media";
import type { VideoPreviewRuntime } from "./usePreviewVideo.shared";

/**
 * 为每个视频/音频 asset 增量创建 CanvasSink / AudioBufferSink，并在 project 变更时清理无效 sinks/节点。
 *
 * 为什么需要这个模块：
 * - sink 创建是异步且较重的操作（打开输入、解析轨道、准备解码管线）。
 * - project 变化（新增视频/音频）时如果"全量清空并重建"会导致已有视频节点被 remove 再 add，
 *   进而触发位置重置等问题，所以这里改为"增量维护"。
 */
export function usePreviewVideoSinks(
  editorRef: RefObject<CanvasEditor | null>,
  project: Project | null,
  runtime: VideoPreviewRuntime,
  setSinksReadyTick: Dispatch<SetStateAction<number>>,
): void {
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }

    const {
      sinksByAssetRef,
      syncedVideoClipIdsRef,
      clipCanvasesRef,
      clipIteratorsRef,
      clipNextFrameRef,
    } = runtime;

    // 无 project：移除所有已有视频片段和 sinks
    if (!project) {
      for (const id of syncedVideoClipIdsRef.current) {
        editor.removeVideo(id);
      }
      syncedVideoClipIdsRef.current.clear();
      clipCanvasesRef.current.clear();
      sinksByAssetRef.current.clear();
      clipIteratorsRef.current.clear();
      clipNextFrameRef.current.clear();
      return;
    }

    // 使用工程逻辑分辨率作为解码输出尺寸，避免因舞台显示缩放导致画质模糊
    const width = project.width;
    const height = project.height;
    // 收集视频和音频 asset
    const videoAssets = project.assets.filter(
      (a) => a.kind === "video" && a.source,
    );
    const audioAssets = project.assets.filter(
      (a) => a.kind === "audio" && a.source,
    );
    const mediaAssetIds = new Set([
      ...videoAssets.map((a) => a.id),
      ...audioAssets.map((a) => a.id),
    ]);
    const videoAssetIds = new Set(videoAssets.map((a) => a.id));
    const sinks = sinksByAssetRef.current;

    // 清理：移除已不存在或 asset 已删的视频 clip 节点，并清理 refs
    for (const clipId of [...syncedVideoClipIdsRef.current]) {
      const clip = findClipById(project, clipId);
      if (!clip || !videoAssetIds.has(clip.assetId)) {
        editor.removeVideo(clipId);
        syncedVideoClipIdsRef.current.delete(clipId);
        clipCanvasesRef.current.delete(clipId);
        clipIteratorsRef.current.delete(clipId);
        clipNextFrameRef.current.delete(clipId);
      }
    }

    // 清理：移除已不在 project 中的 asset 的 sink
    for (const [assetId] of [...sinks]) {
      if (!mediaAssetIds.has(assetId)) {
        sinks.delete(assetId);
      }
    }

    let cancelled = false;

    const setup = async () => {
      // 增量：只为"还没 sink 的视频 asset"创建 sink
      for (const asset of videoAssets) {
        if (cancelled) {
          return;
        }
        if (sinksByAssetRef.current.has(asset.id)) {
          continue;
        }
        try {
          const input = createInputFromUrl(asset.source!);
          const videoTrack = await input.getPrimaryVideoTrack();
          if (!videoTrack || cancelled) {
            return;
          }
          const audioTrack = await input
            .getPrimaryAudioTrack()
            .catch(() => null);
          // 与 examples/media-player 一致：有 audioTrack 即创建 AudioBufferSink
          const audioSink = audioTrack ? new AudioBufferSink(audioTrack) : null;
          const sink = new CanvasSink(videoTrack, {
            width,
            height,
            fit: "contain",
            poolSize: 2,
          });
          sinksByAssetRef.current.set(asset.id, { input, sink, audioSink });
        } catch {
          // 创建单个 asset 失败不影响整体流程
        }
      }

      // 增量：只为"还没 sink 的音频 asset"创建 AudioBufferSink（纯音频，无 CanvasSink）
      for (const asset of audioAssets) {
        if (cancelled) {
          return;
        }
        if (sinksByAssetRef.current.has(asset.id)) {
          continue;
        }
        try {
          const input = createInputFromUrl(asset.source!);
          const audioTrack = await input
            .getPrimaryAudioTrack()
            .catch(() => null);
          if (!audioTrack || cancelled) {
            continue;
          }
          const audioSink = new AudioBufferSink(audioTrack);
          sinksByAssetRef.current.set(asset.id, {
            input,
            sink: null,
            audioSink,
          });
        } catch {
          // 创建单个 asset 失败不影响整体流程
        }
      }

      if (!cancelled) {
        // sinks 准备好，通知静帧同步刷新
        setSinksReadyTick((c) => c + 1);
      }
    };

    void setup();

    return () => {
      cancelled = true;
      // 仅取消本次 setup，不在此清理节点与 refs，避免 project 快速变更时误清
    };
  }, [editorRef, project, runtime, setSinksReadyTick]);
}
