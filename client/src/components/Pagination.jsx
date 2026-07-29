import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function Pagination({ pagination, onPageChange }) {
  if (!pagination || pagination.pages <= 1) return null;
  const { page, pages, total, limit } = pagination;

  const start = (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);

  return (
    <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm dark:border-slate-800">
      <p className="text-slate-500 dark:text-slate-400">
        Showing <span className="font-medium text-slate-700 dark:text-slate-200">{start}-{end}</span> of{' '}
        <span className="font-medium text-slate-700 dark:text-slate-200">{total}</span>
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-40 dark:text-slate-400 dark:hover:bg-slate-800"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="px-2 text-slate-600 dark:text-slate-300">
          Page {page} of {pages}
        </span>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= pages}
          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-40 dark:text-slate-400 dark:hover:bg-slate-800"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
