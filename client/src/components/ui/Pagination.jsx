import { ChevronLeft, ChevronRight } from 'lucide-react';
import clsx from 'clsx';

const PAGE_SIZES = [10, 25, 50];

// Builds a compact page list: 1 … 4 5 [6] 7 8 … 20
function pageWindow(page, pages) {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const set = new Set([1, pages, page - 1, page, page + 1]);
  if (page <= 3) [2, 3, 4].forEach((p) => set.add(p));
  if (page >= pages - 2) [pages - 3, pages - 2, pages - 1].forEach((p) => set.add(p));
  const list = [...set].filter((p) => p >= 1 && p <= pages).sort((a, b) => a - b);
  const out = [];
  for (let i = 0; i < list.length; i++) {
    if (i > 0 && list[i] - list[i - 1] > 1) out.push('…');
    out.push(list[i]);
  }
  return out;
}

export default function Pagination({ pagination, onPageChange, onPageSizeChange, className = '' }) {
  if (!pagination) return null;
  const { page, pages, total, limit } = pagination;
  if (total === 0) return null;

  const start = (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);

  return (
    <nav
      aria-label="Pagination"
      className={clsx('flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 text-sm dark:border-slate-800', className)}
    >
      <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400">
        <p>
          <span className="font-medium text-slate-700 tabular dark:text-slate-200">
            {start}–{end}
          </span>{' '}
          of <span className="font-medium text-slate-700 tabular dark:text-slate-200">{total}</span>
        </p>
        {onPageSizeChange && (
          <label className="hidden items-center gap-1.5 sm:flex">
            <span className="sr-only sm:not-sr-only">Rows</span>
            <select
              value={limit}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="ui-input h-7 w-auto py-0 pl-2 pr-7 text-xs"
              aria-label="Rows per page"
            >
              {PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {pages > 1 && (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            aria-label="Previous page"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent dark:text-slate-400 dark:hover:bg-slate-800"
          >
            <ChevronLeft size={16} aria-hidden="true" />
          </button>
          <div className="hidden items-center gap-1 sm:flex">
            {pageWindow(page, pages).map((item, i) =>
              item === '…' ? (
                <span key={`gap-${i}`} className="px-1 text-slate-400">
                  …
                </span>
              ) : (
                <button
                  key={item}
                  type="button"
                  onClick={() => onPageChange(item)}
                  aria-current={item === page ? 'page' : undefined}
                  className={clsx(
                    'inline-flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-sm tabular transition-colors',
                    item === page
                      ? 'bg-primary-600 font-medium text-white'
                      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                  )}
                >
                  {item}
                </button>
              )
            )}
          </div>
          <span className="px-2 text-slate-600 tabular sm:hidden dark:text-slate-300">
            {page} / {pages}
          </span>
          <button
            type="button"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= pages}
            aria-label="Next page"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent dark:text-slate-400 dark:hover:bg-slate-800"
          >
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        </div>
      )}
    </nav>
  );
}
