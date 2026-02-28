import { useContext } from "react";
import { AddMediaContext } from "./addMediaContext";
import type { AddMediaContextValue } from "./addMediaContext";

export function useAddMediaContext(): AddMediaContextValue {
  const ctx = useContext(AddMediaContext);
  if (!ctx) {
    throw new Error("useAddMediaContext must be used within AddMediaProvider");
  }
  return ctx;
}
