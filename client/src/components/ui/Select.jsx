import { forwardRef } from 'react';
import clsx from 'clsx';

const Select = forwardRef(function Select({ className = '', invalid, children, ...props }, ref) {
  return (
    <select ref={ref} aria-invalid={invalid || undefined} className={clsx('ui-input', className)} {...props}>
      {children}
    </select>
  );
});

export default Select;
