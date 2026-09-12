import { Inbox, AlertTriangle, Loader2, RefreshCw, SearchX } from 'lucide-react';
import Button from './Button';

export function EmptyState({ title = 'Nothing here yet', message = '', action = null, icon: Icon = Inbox, compact = false }) {
  return (
    <div className={compact ? 'flex flex-col items-center justify-center gap-2 px-6 py-8 text-center' : 'flex flex-col items-center justify-center gap-3 px-6 py-16 text-center'}>
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
        <Icon size={22} aria-hidden="true" />
      </div>
      <div>
        <p className="font-medium text-slate-800 dark:text-slate-100">{title}</p>
        {message && <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">{message}</p>}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

export function NoResults({ onClear }) {
  return (
    <EmptyState
      icon={SearchX}
      title="No matches"
      message="Nothing matches the current search or filters."
      action={onClear ? <Button variant="secondary" size="sm" onClick={onClear}>Clear filters</Button> : null}
    />
  );
}

export function ErrorState({ message = 'Something went wrong.', onRetry, compact = false }) {
  return (
    <div role="alert" className={compact ? 'flex flex-col items-center justify-center gap-2 px-6 py-8 text-center' : 'flex flex-col items-center justify-center gap-3 px-6 py-16 text-center'}>
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-500 dark:bg-red-500/10 dark:text-red-400">
        <AlertTriangle size={22} aria-hidden="true" />
      </div>
      <p className="max-w-sm text-sm text-slate-700 dark:text-slate-200">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" icon={RefreshCw} onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function Loading({ label = 'Loading…' }) {
  return (
    <div role="status" className="flex flex-col items-center justify-center gap-2 py-16 text-center">
      <Loader2 className="animate-spin text-primary-500" size={28} aria-hidden="true" />
      <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
    </div>
  );
}

// Inline notice for forms and page-level messages.
export function Alert({ tone = 'info', title, children, className = '' }) {
  const tones = {
    info: 'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200',
    warning: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200',
    danger: 'border-red-200 bg-red-50 text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200',
  };
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={`rounded-lg border px-3.5 py-2.5 text-sm ${tones[tone]} ${className}`}>
      {title && <p className="font-medium">{title}</p>}
      {children && <div className={title ? 'mt-0.5 text-[13px] opacity-90' : ''}>{children}</div>}
    </div>
  );
}
