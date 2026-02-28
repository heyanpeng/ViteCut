import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAddMedia } from "@/hooks/useAddMedia";

export type PendingUpload = {
  id: string;
  name: string;
  type: "video" | "image" | "audio";
  progress: number;
  error?: string;
};

type AddMediaContextValue = {
  trigger: () => void;
  loadFile: (file: File) => Promise<void>;
  pendingUploads: PendingUpload[];
};

const AddMediaContext = createContext<AddMediaContextValue | null>(null);

type AddMediaProviderProps = {
  children: ReactNode;
  /** 上传开始时调用，可用于自动切换到媒体面板以显示进度 */
  onUploadStart?: () => void;
};

export function AddMediaProvider({ children, onUploadStart }: AddMediaProviderProps) {
  const [pendingUploads, setPendingUploads] = useState<PendingUpload[]>([]);

  const {
    trigger,
    loadFile,
    fileInputRef,
    fileInputProps,
  } = useAddMedia({
    onUploadStart: (file) => {
      onUploadStart?.();
      const kind = file.type.startsWith("video/")
        ? "video"
        : file.type.startsWith("image/")
          ? "image"
          : "audio";
      setPendingUploads((prev) => [
        ...prev,
        { id: crypto.randomUUID(), name: file.name, type: kind, progress: 0 },
      ]);
    },
    onUploadProgress: (percent) => {
      setPendingUploads((prev) =>
        prev.length > 0
          ? prev.map((p, i) =>
              i === prev.length - 1 ? { ...p, progress: percent } : p
            )
          : prev
      );
    },
    onUploadComplete: () => {
      setPendingUploads((prev) => prev.slice(0, -1));
    },
    onUploadError: (err) => {
      const msg = err?.message || "上传失败";
      setPendingUploads((prev) =>
        prev.length > 0
          ? prev.map((p, i) =>
              i === prev.length - 1
                ? { ...p, progress: -1, error: msg }
                : p
            )
          : prev
      );
      setTimeout(() => {
        setPendingUploads((prev) => prev.filter((p) => p.progress >= 0));
      }, 3000);
    },
  });

  const value = useMemo<AddMediaContextValue>(
    () => ({ trigger, loadFile, pendingUploads }),
    [trigger, loadFile, pendingUploads]
  );

  return (
    <AddMediaContext.Provider value={value}>
      {children}
      <input ref={fileInputRef} {...fileInputProps} />
    </AddMediaContext.Provider>
  );
}

export function useAddMediaContext(): AddMediaContextValue {
  const ctx = useContext(AddMediaContext);
  if (!ctx) {
    throw new Error("useAddMediaContext must be used within AddMediaProvider");
  }
  return ctx;
}
