import { cloneElement, isValidElement, useId } from 'react';
import clsx from 'clsx';

// Label + control + hint/error wiring. Generates a stable id, links the
// label with htmlFor, and attaches aria-describedby / aria-invalid to the
// control so validation is announced, not just coloured.
//
//   <FormField label="Email" required error={errors.email?.message}>
//     <Input type="email" {...register('email')} />
//   </FormField>
export default function FormField({ label, required, hint, error, className = '', children, inline = false }) {
  const generatedId = useId();
  const child = isValidElement(children) ? children : null;
  const id = child?.props?.id || generatedId;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;

  const control = child
    ? cloneElement(child, {
        id,
        invalid: Boolean(error) || child.props.invalid,
        'aria-describedby': [errorId, hintId, child.props['aria-describedby']].filter(Boolean).join(' ') || undefined,
        'aria-required': required || undefined,
      })
    : children;

  return (
    <div className={clsx(inline ? 'flex items-center gap-3' : 'space-y-1.5', className)}>
      {label && (
        <label htmlFor={id} className="block text-xs font-medium text-slate-700 dark:text-slate-300">
          {label}
          {required && (
            <span className="ml-0.5 text-red-500" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}
      {control}
      {error ? (
        <p id={errorId} role="alert" className="text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-xs text-slate-500 dark:text-slate-400">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
