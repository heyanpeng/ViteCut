import { useEffect, type Dispatch, type RefObject, type SetStateAction } from "react";
import type { CanvasEditor } from "@swiftav/canvas";
import type { Project } from "@swiftav/project";
import { findClipById } from "@swiftav/project";
import { CanvasSink } from "mediabunny";
import { createInputFromUrl } from "@swiftav/media";
import type { VideoPreviewRuntime } from "./usePreviewVideo.shared";
import { getStageSize } from "./usePreviewVideo.shared";

/**
 * 为每个视频 asset 增量创建 CanvasSink，并在 project 变更时清理无效 sinks/节点。
 *
 * 为什么需要这个模块：
 * - sink 创建是异步且较重的操作（打开输入、解析轨道、准备解码管线）。
 * - project 变化（新增视频）时如果“全量清空并重建”会导致已有视频节点被 remove 再 add，
 *   进而触发位置重置等问题，所以这里改为“增量维护”。
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

    const { width, height } = getStageSize(editor);
    const videoAssets = project.assets.filter((a) => a.kind === "video" && a.source);
    const currentAssetIds = new Set(videoAssets.map((a) => a.id));
    const sinks = sinksByAssetRef.current;

    // 清理：移除已不存在或 asset 已删的 clip 节点，并清理 refs
    for (const clipId of [...syncedVideoClipIdsRef.current]) {
      const clip = findClipById(project, clipId);
      if (!clip || !currentAssetIds.has(clip.assetId)) {
        editor.removeVideo(clipId);
        syncedVideoClipIdsRef.current.delete(clipId);
        clipCanvasesRef.current.delete(clipId);
        clipIteratorsRef.current.delete(clipId);
        clipNextFrameRef.current.delete(clipId);
      }
    }

    // 清理：移除已不在 project 中的 asset 的 sink
    for (const [assetId] of [...sinks]) {
      if (!currentAssetIds.has(assetId)) {
        sinks.delete(assetId);
      }
    }

    let cancelled = false;

    const setup = async () => {
      // 增量：只为“还没 sink 的 asset”创建 sink
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
          const sink = new CanvasSink(videoTrack, {
            width,
            height,
            fit: "cover",
            poolSize: 2,
          });
          sinksByAssetRef.current.set(asset.id, { input, sink });
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

