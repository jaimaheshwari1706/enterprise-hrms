import clsx from 'clsx';

// Every status in the system maps to a tone. The dot + text pairing means
// the state is never conveyed by colour alone.
const TONES = {
  success: 'bg-emerald-50 text-emerald-700 ring-emerald-600/15 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/20',
  info: 'bg-sky-50 text-sky-700 ring-sky-600/15 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-400/20',
  warning: 'bg-amber-50 text-amber-700 ring-amber-600/15 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-400/20',
  danger: 'bg-red-50 text-red-700 ring-red-600/15 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-400/20',
  primary: 'bg-primary-50 text-primary-700 ring-primary-600/15 dark:bg-primary-500/10 dark:text-primary-300 dark:ring-primary-400/20',
  neutral: 'bg-slate-100 text-slate-600 ring-slate-500/10 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-400/20',
};

const DOTS = {
  success: 'bg-emerald-500',
  info: 'bg-sky-500',
  warning: 'bg-amber-500',
  danger: 'bg-red-500',
  primary: 'bg-primary-500',
  neutral: 'bg-slate-400',
};

const STATUS_MAP = {
  active: ['success', 'Active'],
  inactive: ['neutral', 'Inactive'],
  present: ['success', 'Present'],
  halfday: ['warning', 'Half day'],
  absent: ['danger', 'Absent'],
  leave: ['primary', 'On leave'],
  pending: ['warning', 'Pending'],
  approved: ['success', 'Approved'],
  rejected: ['danger', 'Rejected'],
  cancelled: ['neutral', 'Cancelled'],
  draft: ['warning', 'Draft'],
  processed: ['info', 'Processed'],
  paid: ['success', 'Paid'],
  notgenerated: ['neutral', 'Not generated'],
  inprogress: ['warning', 'In progress'],
  checkedin: ['success', 'Checked in'],
  checkedout: ['info', 'Checked out'],
  notcheckedin: ['neutral', 'Not checked in'],
};

export default function StatusBadge({ status, label, tone, size = 'sm', className = '' }) {
  const key = String(status || '').toLowerCase().replace(/[\s_-]+/g, '');
  const [mappedTone, mappedLabel] = STATUS_MAP[key] || ['neutral', status];
  const finalTone = tone || mappedTone;
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full font-medium whitespace-nowrap ring-1 ring-inset',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm',
        TONES[finalTone],
        className
      )}
    >
      <span className={clsx('h-1.5 w-1.5 shrink-0 rounded-full', DOTS[finalTone])} aria-hidden="true" />
      {label || mappedLabel || '—'}
    </span>
  );
}

export function Badge({ tone = 'neutral', children, className = '' }) {
  return (
    <span className={clsx('inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset', TONES[tone], className)}>
      {children}
    </span>
  );
}
