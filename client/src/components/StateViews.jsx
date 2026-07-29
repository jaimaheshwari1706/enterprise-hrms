import { Inbox, AlertTriangle, Loader2 } from 'lucide-react';

export function EmptyState({ title = 'Nothing here yet', message = '', action = null }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
      <Inbox className="text-slate-300 dark:text-slate-600" size={32} />
      <p className="font-medium text-slate-700 dark:text-slate-200">{title}</p>
      {message && <p className="max-w-sm text-sm text-slate-500 dark:text-slate-400">{message}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ message = 'Something went wrong.' }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
      <AlertTriangle className="text-red-400" size={32} />
      <p className="text-sm text-red-600 dark:text-red-400">{message}</p>
    </div>
  );
}

export function Loading({ label = 'Loading…' }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
      <Loader2 className="animate-spin text-indigo-500" size={28} />
      <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
    </div>
  );
}
