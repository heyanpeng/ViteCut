import { useRef, useCallback } from "react";
import { useProjectStore } from "@/stores";
import { uploadFileToMediaWithProgress } from "@/utils/uploadFileToMedia";
import {
  notifyMediaAdded,
  notifyMediaRefresh,
} from "@/utils/mediaNotifications";
import type { MediaRecord } from "@/api/mediaApi";

const VIDEO_ACCEPT = "video/*,video/x-matroska,video/mp2t,.ts";
const IMAGE_ACCEPT = "image/*,.jpg,.jpeg,.png,.gif,.webp,.bmp";
const AUDIO_ACCEPT = "audio/*,.mp3,.wav,.aac,.ogg,.flac,.m4a,.wma";
const MEDIA_ACCEPT = `${VIDEO_ACCEPT},${IMAGE_ACCEPT},${AUDIO_ACCEPT}`;

function getKind(file: File): "video" | "image" | "audio" {
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("audio/")) return "audio";
  return "video";
}

export interface UseAddMediaOptions {
  onUploadStart?: (file: File) => void;
  onUploadProgress?: (percent: number) => void;
  onUploadComplete?: () => void;
  onUploadError?: (err: Error) => void;
}

/**
 * 复用添加媒体（视频、图片、音频）逻辑：触发文件选择器并调用 loadVideoFile/loadImageFile/loadAudioFile。
 * 支持进度回调：传入 onUploadProgress 时选择文件后立即展示上传占位并显示进度。
 */
export function useAddMedia(options?: UseAddMediaOptions) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const loadVideoFile = useProjectStore((s) => s.loadVideoFile);
  const loadImageFile = useProjectStore((s) => s.loadImageFile);
  const loadAudioFile = useProjectStore((s) => s.loadAudioFile);

  const trigger = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const loadFile = useCallback(
    async (file: File) => {
      const kind = getKind(file);
      if (
        !file.type.startsWith("video/") &&
        !file.type.startsWith("image/") &&
        !file.type.startsWith("audio/")
      ) {
        console.warn(`不支持的文件类型: ${file.type}`);
        return;
      }

      const opts = optionsRef.current;
      const useProgressFlow = opts?.onUploadProgress != null;

      if (useProgressFlow) {
        opts?.onUploadStart?.(file);
        try {
          const { record } = await uploadFileToMediaWithProgress(
            file,
            opts.onUploadProgress
          );
          notifyMediaAdded(record as MediaRecord);
          opts?.onUploadComplete?.();
        } catch (err) {
          const e = err instanceof Error ? err : new Error(String(err));
          opts?.onUploadError?.(e);
        }
      } else {
        try {
          if (kind === "video") {
            await loadVideoFile(file);
          } else if (kind === "image") {
            await loadImageFile(file);
          } else {
            await loadAudioFile(file);
          }
          notifyMediaRefresh();
        } catch (err) {
          console.error("媒体加载失败:", err);
        }
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
