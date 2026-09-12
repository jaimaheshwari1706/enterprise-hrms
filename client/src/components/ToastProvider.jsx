import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from 'lucide-react';
import { ToastContext } from './ToastContext';

let idCounter = 0;

const ICONS = { success: CheckCircle2, error: XCircle, info: Info, warning: AlertTriangle };
const STYLES = {
  success: 'border-emerald-200 bg-white text-slate-800 dark:border-emerald-500/30 dark:bg-slate-900 dark:text-slate-100 [&_svg]:text-emerald-500',
  error: 'border-red-200 bg-white text-slate-800 dark:border-red-500/30 dark:bg-slate-900 dark:text-slate-100 [&_svg]:text-red-500',
  info: 'border-sky-200 bg-white text-slate-800 dark:border-sky-500/30 dark:bg-slate-900 dark:text-slate-100 [&_svg]:text-sky-500',
  warning: 'border-amber-200 bg-white text-slate-800 dark:border-amber-500/30 dark:bg-slate-900 dark:text-slate-100 [&_svg]:text-amber-500',
};

const DURATION = { success: 4000, info: 5000, warning: 6000, error: 7000 };

function Toast({ toast, onDismiss }) {
  const timer = useRef(null);
  const Icon = ICONS[toast.type] || Info;

  const start = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => onDismiss(toast.id), DURATION[toast.type] || 4000);
  }, [onDismiss, toast.id, toast.type]);

  useEffect(() => {
    start();
    return () => clearTimeout(timer.current);
  }, [start]);

  return (
    <div
      role={toast.type === 'error' ? 'alert' : 'status'}
      onMouseEnter={() => clearTimeout(timer.current)}
      onMouseLeave={start}
      className={`pointer-events-auto flex w-full max-w-sm animate-slide-in-right items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-popover ${STYLES[toast.type] || STYLES.info}`}
    >
      <Icon size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        {toast.title && <p className="font-medium">{toast.title}</p>}
        <p className={toast.title ? 'text-[13px] text-slate-600 dark:text-slate-300' : ''}>{toast.message}</p>
      </div>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
        className="-mr-1 -mt-0.5 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
      >
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // showToast(message, type?) keeps the old signature; an options object
  // ({ title, message, type }) is also accepted.
  const showToast = useCallback((messageOrOptions, type = 'success') => {
    const id = ++idCounter;
    const toast =
      typeof messageOrOptions === 'object' && messageOrOptions !== null
        ? { id, type: 'success', ...messageOrOptions }
        : { id, message: messageOrOptions, type };
    setToasts((prev) => [...prev.slice(-4), toast]);
    return id;
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, dismissToast: removeToast }}>
      {children}
      <div
        aria-live="polite"
        aria-relevant="additions"
        className="pointer-events-none fixed inset-x-4 bottom-4 z-[100] flex flex-col items-end gap-2 sm:inset-x-auto sm:right-4"
      >
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} onDismiss={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}
