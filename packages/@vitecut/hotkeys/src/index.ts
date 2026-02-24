export type TimelineHotkeyCommandId =
  | "timeline.clip.copy"
  | "timeline.clip.paste"
  | "timeline.clip.delete"
  | "timeline.clip.cut"
  | "timeline.playback.toggle"
  | "timeline.undo"
  | "timeline.redo"
  | "timeline.zoom.in"
  | "timeline.zoom.out"
  | "timeline.zoom.fit";

export const TimelineHotkeyCommand: Record<
  Uppercase<Exclude<TimelineHotkeyCommandId, never>> | string,
  TimelineHotkeyCommandId
> = {
  CLIP_COPY: "timeline.clip.copy",
  CLIP_PASTE: "timeline.clip.paste",
  CLIP_DELETE: "timeline.clip.delete",
  CLIP_CUT: "timeline.clip.cut",
  PLAYBACK_TOGGLE: "timeline.playback.toggle",
  UNDO: "timeline.undo",
  REDO: "timeline.redo",
  ZOOM_IN: "timeline.zoom.in",
  ZOOM_OUT: "timeline.zoom.out",
  ZOOM_FIT: "timeline.zoom.fit",
};

export interface TimelineHotkeyHandlers {
  onCopyClip?: () => void;
  onPasteClip?: () => void;
  onDeleteClip?: () => void;
  onCutClip?: () => void;
  onTogglePlay?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onZoomFit?: () => void;
}

export interface UseTimelineHotkeysOptions extends TimelineHotkeyHandlers {
  /**
   * 是否启用快捷键。
   * 允许在时间轴未聚焦或项目为空时整体关闭。
   */
  enabled?: boolean;
}

export { useTimelineHotkeys } from "./useTimelineHotkeys";
