import clsx from 'clsx';

// Filter row above a table: wraps on small screens, keeps the primary
// actions right-aligned on wide ones.
export function Toolbar({ children, actions, className = '' }) {
  return (
    <div className={clsx('mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between', className)}>
      <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">{children}</div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
