import clsx from 'clsx';

export function Card({ className = '', children, as: Tag = 'div', padded = false, ...props }) {
  return (
    <Tag className={clsx('ui-card', padded && 'p-5', className)} {...props}>
      {children}
    </Tag>
  );
}

export function CardHeader({ title, description, actions, className = '', children }) {
  return (
    <div className={clsx('flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800', className)}>
      <div className="min-w-0">
        {title && <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h3>}
        {description && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{description}</p>}
        {children}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

export function CardBody({ className = '', children }) {
  return <div className={clsx('p-5', className)}>{children}</div>;
}

export function CardFooter({ className = '', children }) {
  return <div className={clsx('border-t border-slate-200 px-5 py-3 dark:border-slate-800', className)}>{children}</div>;
}
