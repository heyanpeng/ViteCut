import { useEffect, useRef, type RefObject } from "react";
import type { CanvasEditor } from "@vitecut/canvas";
import type { Project } from "@vitecut/project";
import { playbackClock } from "./playbackClock";

/**
 * 根据 currentTime 将“可见”文本片段同步到画布上。
 * 逻辑：仅显示 start <= t < end 的文本片段；通过与内部已同步的文本片段 ID 集合 diff，实现 add/update/remove 操作。
 * 播放时从 playbackClock 读取时间（store.currentTime 不每帧更新），暂停时用 store.currentTime。
 */
export function usePreviewTextSync(
  editorRef: RefObject<CanvasEditor | null>,
  project: Project | null,
  currentTime: number,
  isPlaying: boolean,
  resizeTick?: number,
): void {
  // 已同步到画布上的文本 clip id 集合，避免重复 add/remove
  const syncedTextClipIdsRef = useRef<Set<string>>(new Set());

  const syncTextForTime = (t: number) => {
    const editor = editorRef.current;
    if (!editor || !project) {
      return;
    }
    // 收集当前时间点可见的所有文本 clip 信息
    const visibleTextClips: Array<{
      id: string;
      text: string;
      x: number;
      y: number;
      offsetX?: number;
      offsetY?: number;
      fontSize: number;
      fill: string;
      fontFamily?: string;
      fontStyle?: string;
      textDecoration?: string;
      lineHeight?: number;
      letterSpacing?: number;
      align?: string;
      opacity?: number;
      scaleX: number;
      scaleY: number;
      rotation: number;
    }> = [];

    // 按轨道 order 升序遍历（order 大的后绘制，显示在上层）
    const tracksByOrder = [...project.tracks].sort((a, b) => a.order - b.order);
    for (const track of tracksByOrder) {
      // 跳过被隐藏的轨道
      if (track.hidden) {
        continue;
      }
      // 遍历轨道的片段
      for (const clip of track.clips) {
        // 仅处理 kind 为 "text" 且在当前时间可见的片段
        if (
          clip.kind !== "text" ||
          clip.start > t || // 尚未开始
          clip.end <= t // 已结束
        ) {
          continue;
        }
        // 找到与 clip 对应的 asset（用于补齐初始文本等信息）
        const asset = project.assets.find((a) => a.id === clip.assetId);

        // 合并参数配置（优先 clip.params，其次 asset.textMeta.initialText）
        const params = (clip.params ?? {}) as {
          text?: string;
          fontSize?: number;
          fill?: string;
          fontFamily?: string;
          fontStyle?: string;
          textDecoration?: string;
          lineHeight?: number;
          letterSpacing?: number;
          align?: string;
          opacity?: number;
        };

        // 将工程坐标（project 宽高）缩放到画布坐标（stage 宽高）
        const stageSize = editor.getStage().size();
        const scaleX = stageSize.width / project.width;
        const scaleY = stageSize.height / project.height;
        const scale = Math.min(scaleX, scaleY);
        const projX = clip.transform?.x ?? 0;
        const projY = clip.transform?.y ?? 0;
        const anchorX = clip.transform?.anchorX ?? 0;
        const anchorY = clip.transform?.anchorY ?? 0;

        visibleTextClips.push({
          id: clip.id,
          text: params.text ?? asset?.textMeta?.initialText ?? "",
          x: projX * scaleX,
          y: projY * scaleY,
          offsetX: anchorX * scale,
          offsetY: anchorY * scale,
          fontSize: (params.fontSize ?? 32) * scale,
          fill: params.fill ?? "#ffffff",
          fontFamily: params.fontFamily,
          fontStyle: params.fontStyle ?? "normal",
          textDecoration: params.textDecoration ?? "",
          lineHeight: params.lineHeight ?? 1,
          letterSpacing: (params.letterSpacing ?? 1) * scale,
          align: params.align ?? "left",
          opacity: params.opacity ?? 1,
          scaleX: clip.transform?.scaleX ?? 1,
          scaleY: clip.transform?.scaleY ?? 1,
          rotation: clip.transform?.rotation ?? 0,
        });
      }
    }

    // 当前帧所有可见文本片段 id 集合
    const visibleIds = new Set(visibleTextClips.map((c) => c.id));
    // step1: 移除当前不可见但上次渲染时存在的文本片段
    for (const id of syncedTextClipIdsRef.current) {
      if (!visibleIds.has(id)) {
        editor.removeText(id);
        syncedTextClipIdsRef.current.delete(id);
      }
    }
    // step2: 按当前 visibleTextClips 添加或更新文本
    for (const clip of visibleTextClips) {
      if (syncedTextClipIdsRef.current.has(clip.id)) {
        // 已存在，更新内容和变换属性（含 scale/rotation，undo 时能正确恢复）
        editor.updateText(clip.id, {
          text: clip.text,
          x: clip.x,
          y: clip.y,
          offsetX: clip.offsetX,
          offsetY: clip.offsetY,
          fontSize: clip.fontSize,
          fill: clip.fill,
          fontFamily: clip.fontFamily,
          fontStyle: clip.fontStyle,
          textDecoration: clip.textDecoration,
          lineHeight: clip.lineHeight,
          letterSpacing: clip.letterSpacing,
          align: clip.align,
          opacity: clip.opacity,
          scaleX: clip.scaleX,
          scaleY: clip.scaleY,
          rotation: clip.rotation,
        });
      } else {
        // 首次出现在可见集，添加到画布
        editor.addText({
          id: clip.id,
          text: clip.text,
          x: clip.x,
          y: clip.y,
          offsetX: clip.offsetX,
          offsetY: clip.offsetY,
          fontSize: clip.fontSize,
          fill: clip.fill,
          fontFamily: clip.fontFamily,
          fontStyle: clip.fontStyle,
          textDecoration: clip.textDecoration,
          lineHeight: clip.lineHeight,
          letterSpacing: clip.letterSpacing,
          align: clip.align,
          opacity: clip.opacity,
          scaleX: clip.scaleX,
          scaleY: clip.scaleY,
          rotation: clip.rotation,
        });
        syncedTextClipIdsRef.current.add(clip.id);
      }
    }
  };

  // project 卸载时清理
  useEffect(() => {
    if (project) return;
    const editor = editorRef.current;
    if (!editor) return;
    for (const id of syncedTextClipIdsRef.current) {
      editor.removeText(id);
    }
    syncedTextClipIdsRef.current.clear();
  }, [editorRef, project]);

  // 暂停时：用 store.currentTime 同步（store 在 seek/暂停时会更新）
  // resizeTick 变化时也需重新同步，确保画布缩放后元素位置/大小正确
  useEffect(() => {
    if (isPlaying || !project) return;
    const editor = editorRef.current;
    if (!editor) return;
    syncTextForTime(currentTime);
  }, [editorRef, project, currentTime, isPlaying, resizeTick]);

  // 播放时：rAF 循环从 playbackClock 读取时间并同步（store 不每帧更新）
  useEffect(() => {
    if (!isPlaying || !project) return;
    let rafId: number | null = null;
    const loop = () => {
      syncTextForTime(playbackClock.currentTime);
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
    return () => {
      if (rafId != null) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [editorRef, project, isPlaying]);
}
