import { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';
import clsx from 'clsx';

const TONES = {
  default: 'text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white',
  primary: 'text-primary-600 hover:bg-primary-50 dark:text-primary-400 dark:hover:bg-primary-500/10',
  success: 'text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-500/10',
  danger: 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10',
};

const SIZES = { sm: 'h-7 w-7', md: 'h-8 w-8', lg: 'h-9 w-9' };

// Icon-only control. `label` is mandatory: it becomes the accessible name
// *and* the tooltip, so a screen reader and a mouse user get the same info.
// Pass `as={Link}` (with `to`) to render a navigation link with the same
// look — a link, not a button, so it works with middle-click/open-in-tab.
const IconButton = forwardRef(function IconButton(
  { label, icon: Icon, tone = 'default', size = 'md', className = '', loading = false, disabled, iconSize = 16, as: Component = 'button', ...props },
  ref
) {
  const isButton = Component === 'button';
  return (
    <Component
      ref={ref}
      {...(isButton ? { type: 'button', disabled: disabled || loading } : { 'aria-disabled': disabled || undefined })}
      aria-label={label}
      title={label}
      className={clsx(
        'inline-flex shrink-0 items-center justify-center rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        TONES[tone],
        SIZES[size],
        className
      )}
      {...props}
    >
      {loading ? <Loader2 size={iconSize} className="animate-spin" aria-hidden="true" /> : <Icon size={iconSize} aria-hidden="true" />}
    </Component>
  );
});

export default IconButton;
