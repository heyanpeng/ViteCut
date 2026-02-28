import { useContext } from "react";
import { ToastContext } from "./toasterContext";
import type { ToastContextValue } from "./toasterContext";

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within ToasterProvider");
  }
  return ctx;
}
