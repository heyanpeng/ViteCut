import { useCallback, useState, type ReactNode } from "react";
import { CheckCircle, XCircle } from "lucide-react";
import { Toast } from "radix-ui";
import { ToastContext } from "./toasterContext";
import type { ToastType } from "./toasterContext";
import "./Toaster.css";

type ToastItem = {
  id: number;
  message: string;
  type: ToastType;
};

type ToasterProviderProps = {
  children: ReactNode;
};

export function ToasterProvider({ children }: ToasterProviderProps) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback(
    (message: string, type: ToastType = "success") => {
      const id = Date.now();
      setToasts((prev) => [...prev, { id, message, type }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 3000);
    },
    []
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      <Toast.Provider duration={3000} swipeDirection="right">
        {children}
        <Toast.Viewport className="toaster-viewport" />
        {toasts.map(({ id, message, type }) => (
          <Toast.Root key={id} className={`toaster-root toaster-root--${type}`}>
            {type === "success" ? (
              <CheckCircle size={20} className="toaster-icon" aria-hidden />
            ) : (
              <XCircle size={20} className="toaster-icon" aria-hidden />
            )}
            <Toast.Description className="toaster-message">
              {message}
            </Toast.Description>
          </Toast.Root>
        ))}
      </Toast.Provider>
    </ToastContext.Provider>
  );
}
