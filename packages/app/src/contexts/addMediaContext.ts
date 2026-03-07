import { createContext } from "react";
import type { MediaRecord } from "@/api/mediaApi";

export type PendingUpload = {
  id: string;
  name: string;
  type: "video" | "image" | "audio";
  progress: number;
  error?: string;
};

export type AddMediaContextValue = {
  trigger: () => void;
  loadFile: (file: File) => Promise<void>;
  /** 统一上传入口：带上传占位/进度，并返回入库后的媒体记录 */
  uploadFile: (file: File) => Promise<MediaRecord>;
  pendingUploads: PendingUpload[];
};

export const AddMediaContext = createContext<AddMediaContextValue | null>(null);
