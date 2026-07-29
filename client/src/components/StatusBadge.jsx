const STYLES = {
  active: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
  present: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
  approved: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
  paid: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
  processed: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400',
  halfday: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
  pending: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
  draft: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
  leave: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400',
  absent: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400',
  rejected: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400',
  inactive: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  cancelled: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
};

const DEFAULT_STYLE = 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400';

export default function StatusBadge({ status }) {
  const key = String(status || '').toLowerCase().replace(/\s+/g, '');
  const style = STYLES[key] || DEFAULT_STYLE;

  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${style}`}>{status}</span>;
}
