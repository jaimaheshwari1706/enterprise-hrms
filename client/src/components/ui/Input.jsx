import { forwardRef } from 'react';
import clsx from 'clsx';

// Plain text-like input. All visual styling lives in the `.ui-input` class
// (index.css) so raw <input>s can opt in with the same class.
const Input = forwardRef(function Input({ className = '', leftIcon: LeftIcon, invalid, ...props }, ref) {
  if (LeftIcon) {
    return (
      <div className="relative">
        <LeftIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
        <input ref={ref} aria-invalid={invalid || undefined} className={clsx('ui-input pl-9', className)} {...props} />
      </div>
    );
  }
  return <input ref={ref} aria-invalid={invalid || undefined} className={clsx('ui-input', className)} {...props} />;
});

export default Input;
