import { useEffect, useState } from "react";
import "./WorkflowEmbeddedToast.css";

export function useEmbeddedToast(): {
  toast: { key: number; message: string } | null;
  show: (message: string) => void;
} {
  const [toast, setToast] = useState<{ key: number; message: string } | null>(
    null
  );

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 1800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  return {
    toast,
    show: (message: string) =>
      setToast({ key: Date.now() + Math.random(), message }),
  };
}

export function WorkflowEmbeddedToast({
  toast,
}: {
  toast: { key: number; message: string } | null;
}) {
  if (!toast) return null;
  return (
    <div key={toast.key} className="vitecut-embed-toast" role="status">
      <span className="vitecut-embed-toast__dot" aria-hidden />
      <span>{toast.message}</span>
    </div>
  );
}
