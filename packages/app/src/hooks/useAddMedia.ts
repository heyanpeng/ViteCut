import { useRef, useCallback } from "react";
import { useProjectStore } from "@/stores";

const VIDEO_ACCEPT = "video/*,video/x-matroska,video/mp2t,.ts";
const IMAGE_ACCEPT = "image/*,.jpg,.jpeg,.png,.gif,.webp,.bmp";
const AUDIO_ACCEPT = "audio/*,.mp3,.wav,.aac,.ogg,.flac,.m4a,.wma";
const MEDIA_ACCEPT = `${VIDEO_ACCEPT},${IMAGE_ACCEPT},${AUDIO_ACCEPT}`;

function notifyMediaRefresh(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("vitecut-media-refresh"));
  }
}

/**
 * 复用添加媒体（视频、图片、音频）逻辑：触发文件选择器并调用 loadVideoFile/loadImageFile/loadAudioFile。
 * 上传由项目 store 完成并写入后端媒体库，添加成功后通知媒体面板刷新。
 */
export function useAddMedia() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const loadVideoFile = useProjectStore((s) => s.loadVideoFile);
  const loadImageFile = useProjectStore((s) => s.loadImageFile);
  const loadAudioFile = useProjectStore((s) => s.loadAudioFile);

  const trigger = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const loadFile = useCallback(
    async (file: File) => {
      try {
        if (file.type.startsWith("video/")) {
          await loadVideoFile(file);
          notifyMediaRefresh();
        } else if (file.type.startsWith("image/")) {
          await loadImageFile(file);
          notifyMediaRefresh();
        } else if (file.type.startsWith("audio/")) {
          await loadAudioFile(file);
          notifyMediaRefresh();
        } else {
          console.warn(`不支持的文件类型: ${file.type}`);
        }
      } catch (err) {
        console.error("媒体加载失败:", err);
      }
    },
    [loadVideoFile, loadImageFile, loadAudioFile]
  );

  const handleFileChange: React.ChangeEventHandler<HTMLInputElement> =
    useCallback(
      async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        try {
          await loadFile(file);
        } finally {
          event.target.value = "";
        }
      },
      [loadFile]
    );

  return {
    trigger,
    loadFile,
    fileInputRef,
    fileInputProps: {
      type: "file" as const,
      accept: MEDIA_ACCEPT,
      style: { display: "none" },
      onChange: handleFileChange,
    },
  };
}
