import { Link } from 'react-router-dom';
import clsx from 'clsx';

const ACCENTS = {
  primary: 'bg-primary-50 text-primary-600 dark:bg-primary-500/10 dark:text-primary-300',
  emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300',
  amber: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300',
  red: 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300',
  sky: 'bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-300',
  slate: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
};

// KPI tile. `hint` is a one-liner under the value (e.g. "of 120 active");
// `to` makes the whole tile a link to the underlying list.
export default function StatCard({ label, value, icon: Icon, accent = 'primary', hint, to, valueClassName = '', children }) {
  const Wrapper = to ? Link : 'div';
  return (
    <Wrapper
      to={to}
      className={clsx(
        'ui-card group block p-4 sm:p-5 transition-[box-shadow,border-color]',
        to && 'hover:border-slate-300 hover:shadow-popover dark:hover:border-slate-700'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-medium uppercase leading-4 tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
        {Icon && (
          <div className={clsx('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', ACCENTS[accent])}>
            <Icon size={16} aria-hidden="true" />
          </div>
        )}
      </div>
      <p className={clsx('mt-3 text-2xl font-semibold tracking-tight text-slate-900 tabular dark:text-white', valueClassName)}>{value}</p>
      {hint && <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">{hint}</p>}
      {children}
    </Wrapper>
  );
}
