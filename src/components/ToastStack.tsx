import { Check, TriangleAlert, X } from 'lucide-react';

export type Toast = {
  id: number;
  message: string;
  tone: 'success' | 'warning' | 'error';
};

interface ToastStackProps {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}

export function ToastStack({ toasts, onDismiss }: ToastStackProps) {
  return (
    <div className="toast-stack" aria-live="polite" aria-atomic="false">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`toast toast-${toast.tone}`}
          role={toast.tone === 'error' ? 'alert' : 'status'}
        >
          {toast.tone === 'success' ? <Check size={16} /> : <TriangleAlert size={16} />}
          <span>{toast.message}</span>
          <button aria-label="Dismiss notification" onClick={() => onDismiss(toast.id)}>
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
