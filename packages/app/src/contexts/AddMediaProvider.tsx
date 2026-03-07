import { useCallback, useMemo, useState, type ReactNode } from "react";
import { useToast } from "@/components/Toaster";
import { useAddMedia } from "@/hooks/useAddMedia";
import { uploadFileToMediaWithProgress } from "@/utils/uploadFileToMedia";
import { notifyMediaAdded } from "@/utils/mediaNotifications";
import type { MediaRecord } from "@/api/mediaApi";
import { AddMediaContext } from "./addMediaContext";
import type { AddMediaContextValue, PendingUpload } from "./addMediaContext";

type AddMediaProviderProps = {
  children: ReactNode;
  /** 上传开始时调用，可用于自动切换到媒体面板以显示进度 */
  onUploadStart?: () => void;
};

export function AddMediaProvider({
  children,
  onUploadStart,
}: AddMediaProviderProps) {
  const [pendingUploads, setPendingUploads] = useState<PendingUpload[]>([]);
  const { showToast } = useToast();

  const getUploadKind = (file: File): PendingUpload["type"] => {
    if (file.type.startsWith("video/")) {
      return "video";
    }
    if (file.type.startsWith("image/")) {
      return "image";
    }
    return "audio";
  };

  const uploadFile = useCallback(
    async (file: File): Promise<MediaRecord> => {
      onUploadStart?.();
      const uploadId = crypto.randomUUID();
      setPendingUploads((prev) => [
        ...prev,
        {
          id: uploadId,
          name: file.name,
          type: getUploadKind(file),
          progress: 0,
        },
      ]);
      try {
        const { record } = await uploadFileToMediaWithProgress(file, (percent) => {
          setPendingUploads((prev) =>
            prev.map((p) => (p.id === uploadId ? { ...p, progress: percent } : p))
          );
        });
        setPendingUploads((prev) => prev.filter((p) => p.id !== uploadId));
        notifyMediaAdded(record as MediaRecord);
        showToast("已上传到媒体库");
        return record as MediaRecord;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "上传失败";
        setPendingUploads((prev) =>
          prev.map((p) =>
            p.id === uploadId ? { ...p, progress: -1, error: msg } : p
          )
        );
        setTimeout(() => {
          setPendingUploads((prev) =>
            prev.filter((p) => !(p.id === uploadId && p.progress < 0))
          );
        }, 3000);
        throw (err instanceof Error ? err : new Error(String(err)));
      }
    },
    [onUploadStart, showToast]
  );

  const { trigger, loadFile, fileInputRef, fileInputProps } = useAddMedia({
    onUploadStart: (file, uploadId) => {
      onUploadStart?.();
      setPendingUploads((prev) => [
        ...prev,
        {
          id: uploadId,
          name: file.name,
          type: getUploadKind(file),
          progress: 0,
        },
      ]);
    },
    onUploadProgress: (uploadId, percent) => {
      setPendingUploads((prev) =>
        prev.map((p) => (p.id === uploadId ? { ...p, progress: percent } : p))
      );
    },
    onUploadComplete: (uploadId) => {
      setPendingUploads((prev) => prev.filter((p) => p.id !== uploadId));
      showToast("已上传到媒体库");
    },
    onUploadError: (uploadId, err) => {
      const msg = err?.message || "上传失败";
      setPendingUploads((prev) =>
        prev.map((p) =>
          p.id === uploadId ? { ...p, progress: -1, error: msg } : p
        )
      );
      setTimeout(() => {
        setPendingUploads((prev) =>
          prev.filter((p) => !(p.id === uploadId && p.progress < 0))
        );
      }, 3000);
    },
  });

  const value = useMemo<AddMediaContextValue>(
    () => ({ trigger, loadFile, uploadFile, pendingUploads }),
    [trigger, loadFile, uploadFile, pendingUploads]
  );

  return (
    <AddMediaContext.Provider value={value}>
      {children}
      <input ref={fileInputRef} {...fileInputProps} />
    </AddMediaContext.Provider>
  );
}
