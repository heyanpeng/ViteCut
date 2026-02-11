/**
 * 预览组件：按当前时间与播放状态渲染工程画布（多轨视频 + 文本）。
 * - 视频：每个视频 asset 一个 CanvasSink；按 currentTime 算 active 片段，每个片段一个 canvas 用 addVideo 挂到画布。
 * - 播放时用 iterator 预取下一帧，在 rAF 内按 playbackTime 消费并拉下一帧，保证流畅；暂停/seek 时用 getCanvas 拉单帧。
 * - 文本：与视频一致，仅当 start <= currentTime < end 时在画布上 add/update，否则 remove。
 */
import { useRef } from "react";
import { useProjectStore } from "@/stores";
import { usePreviewCanvas } from "./usePreviewCanvas";
import { usePreviewTextSync } from "./usePreviewTextSync";
import { usePreviewVideo } from "./usePreviewVideo";
import "./Preview.css";

export function Preview() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rafIdRef = useRef<number | null>(null);

  const editorRef = usePreviewCanvas(containerRef, rafIdRef);

  const project = useProjectStore((s) => s.project);
  const currentTime = useProjectStore((s) => s.currentTime);

  usePreviewTextSync(editorRef, project, currentTime);
  usePreviewVideo(editorRef, rafIdRef);

  return <div className="preview-container" ref={containerRef} />;
}
