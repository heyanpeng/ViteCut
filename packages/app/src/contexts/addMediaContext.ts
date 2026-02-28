import { createContext } from "react";

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
  pendingUploads: PendingUpload[];
};

export const AddMediaContext = createContext<AddMediaContextValue | null>(null);
