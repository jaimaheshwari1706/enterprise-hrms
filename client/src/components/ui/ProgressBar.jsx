import clsx from 'clsx';

const TONES = {
  primary: 'bg-primary-500',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-red-500',
};

export default function ProgressBar({ value = 0, max = 100, tone = 'primary', label, className = '' }) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-label={label}
      className={clsx('h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800', className)}
    >
      <div className={clsx('h-full rounded-full transition-[width] duration-300', TONES[tone])} style={{ width: `${pct}%` }} />
    </div>
  );
}
