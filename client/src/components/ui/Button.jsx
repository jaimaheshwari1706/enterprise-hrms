import { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';
import clsx from 'clsx';

const VARIANTS = {
  primary:
    'bg-primary-600 text-white shadow-xs hover:bg-primary-700 active:bg-primary-800 disabled:hover:bg-primary-600',
  secondary:
    'border border-slate-300 bg-white text-slate-700 shadow-xs hover:bg-slate-50 active:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:active:bg-slate-700',
  danger: 'bg-red-600 text-white shadow-xs hover:bg-red-700 active:bg-red-800 disabled:hover:bg-red-600',
  success: 'bg-emerald-600 text-white shadow-xs hover:bg-emerald-700 active:bg-emerald-800 disabled:hover:bg-emerald-600',
  ghost:
    'text-slate-600 hover:bg-slate-100 hover:text-slate-900 active:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white',
  link: 'text-primary-600 hover:underline dark:text-primary-400 px-0 py-0 h-auto',
};

const SIZES = {
  xs: 'h-7 px-2 text-xs gap-1.5 rounded-md',
  sm: 'h-8 px-3 text-sm gap-1.5 rounded-lg',
  md: 'h-9 px-3.5 text-sm gap-2 rounded-lg',
  lg: 'h-10 px-4 text-sm gap-2 rounded-lg',
};

// The one button. `loading` disables the control, swaps the leading icon
// for a spinner and announces busy state — so a double-click can never
// submit twice.
const Button = forwardRef(function Button(
  { variant = 'primary', size = 'md', className = '', disabled, loading = false, icon: Icon, iconRight: IconRight, type = 'button', children, ...props },
  ref
) {
  const isDisabled = disabled || loading;
  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={clsx(
        'inline-flex select-none items-center justify-center whitespace-nowrap font-medium transition-[background-color,box-shadow,transform] duration-150',
        'disabled:cursor-not-allowed disabled:opacity-60 active:scale-[0.99]',
        VARIANTS[variant],
        variant !== 'link' && SIZES[size],
        className
      )}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" /> : Icon ? <Icon className="h-4 w-4 shrink-0" aria-hidden="true" /> : null}
      {children}
      {IconRight && !loading ? <IconRight className="h-4 w-4 shrink-0" aria-hidden="true" /> : null}
    </button>
  );
});

export default Button;
