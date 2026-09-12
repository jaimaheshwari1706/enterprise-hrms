import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

// Consistent page top: optional breadcrumb, title, one-line description,
// and a right-aligned action slot that wraps under the title on phones.
export default function PageHeader({ title, description, actions, breadcrumb, meta }) {
  return (
    <div className="mb-6 animate-fade-in">
      {breadcrumb?.length > 0 && (
        <nav aria-label="Breadcrumb" className="mb-2">
          <ol className="flex flex-wrap items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
            {breadcrumb.map((item, index) => (
              <li key={`${item.label}-${index}`} className="flex items-center gap-1">
                {index > 0 && <ChevronRight size={12} aria-hidden="true" className="text-slate-400" />}
                {item.to ? (
                  <Link to={item.to} className="hover:text-slate-800 hover:underline dark:hover:text-slate-200">
                    {item.label}
                  </Link>
                ) : (
                  <span aria-current="page" className="text-slate-700 dark:text-slate-200">
                    {item.label}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </nav>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white sm:text-2xl">{title}</h1>
          {description && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>}
          {meta}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
