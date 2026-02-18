import { useRef, useCallback } from "react";
import { useProjectStore } from "@/stores";
import {
  add as addToMediaStorage,
  type MediaRecord,
} from "@/utils/mediaStorage";
import {
  decodeAudioToPeaks,
  drawWaveformToDataUrl,
} from "@/utils/audioWaveform";

const VIDEO_ACCEPT = "video/*,video/x-matroska,video/mp2t,.ts";
const IMAGE_ACCEPT = "image/*,.jpg,.jpeg,.png,.gif,.webp,.bmp";
const AUDIO_ACCEPT = "audio/*,.mp3,.wav,.aac,.ogg,.flac,.m4a,.wma";
const MEDIA_ACCEPT = `${VIDEO_ACCEPT},${IMAGE_ACCEPT},${AUDIO_ACCEPT}`;

/**
 * 复用添加媒体（视频、图片、音频）逻辑：触发文件选择器并调用 loadVideoFile/loadImageFile/loadAudioFile，
 * 视频和图片同时写入媒体库（IndexedDB）。
 */
export function useAddMedia() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const loadVideoFile = useProjectStore((s) => s.loadVideoFile);
  const loadImageFile = useProjectStore((s) => s.loadImageFile);
  const loadAudioFile = useProjectStore((s) => s.loadAudioFile);

  const trigger = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const addFileToMediaLibrary = useCallback(async (file: File) => {
    const isVideo = file.type.startsWith("video/");
    const isImage = file.type.startsWith("image/");
    const isAudio = file.type.startsWith("audio/");
    if (!isVideo && !isImage && !isAudio) return;

    const type: MediaRecord["type"] = isVideo
      ? "video"
      : isImage
        ? "image"
        : "audio";

    let coverUrl: string | undefined;
    if (type === "audio") {
      try {
        const peaks = await decodeAudioToPeaks(file, 512);
        coverUrl = drawWaveformToDataUrl(peaks);
      } catch {
        coverUrl = undefined;
      }
    }

    const record: MediaRecord = {
      id: crypto.randomUUID(),
      name: file.name,
      type,
      addedAt: Date.now(),
      blob: file,
      coverUrl,
    };
    await addToMediaStorage(record);
  }, []);

  const loadFile = useCallback(
    async (file: File) => {
      try {
        if (file.type.startsWith("video/")) {
          await loadVideoFile(file);
          await addFileToMediaLibrary(file);
        } else if (file.type.startsWith("image/")) {
          await loadImageFile(file);
          await addFileToMediaLibrary(file);
        } else if (file.type.startsWith("audio/")) {
          await loadAudioFile(file);
          await addFileToMediaLibrary(file);
        } else {
          console.warn(`不支持的文件类型: ${file.type}`);
        }
      } catch (err) {
        console.error("媒体加载失败:", err);
      }
    },
    [loadVideoFile, loadImageFile, loadAudioFile, addFileToMediaLibrary],
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
      [loadFile],
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
