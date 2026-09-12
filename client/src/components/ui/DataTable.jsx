import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import clsx from 'clsx';
import { TableSkeleton } from './Skeleton';
import { EmptyState, ErrorState } from './StateViews';
import Pagination from './Pagination';

// The one table. Handles loading (skeleton, then a subtle overlay while
// refetching), error (with retry), empty, sorting, column alignment, row
// actions, and a stacked card layout under the `md` breakpoint so tables
// stay usable on phones instead of overflowing.
//
// columns: [{
//   key, header, render?(row), sortKey?, align?: 'left'|'right'|'center',
//   width?, className?, hideOnMobile?, primary? (shown as the card title on mobile),
//   mobileLabel? (defaults to header)
// }]
export default function DataTable({
  columns,
  rows = [],
  rowKey = (row) => row._id || row.id,
  status = 'ready',
  isFetching = false,
  error,
  onRetry,
  sort,
  onSort,
  pagination,
  onPageChange,
  onPageSizeChange,
  emptyTitle = 'Nothing to show',
  emptyMessage = '',
  emptyAction,
  emptyIcon,
  onRowClick,
  rowClassName,
  skeletonRows = 6,
  caption,
  dense = false,
  footer,
}) {
  const isInitialLoading = status === 'loading';
  const visibleColumns = columns.filter((c) => !c.hidden);

  if (isInitialLoading) {
    return <TableSkeleton rows={skeletonRows} columns={Math.min(visibleColumns.length, 5)} />;
  }
  if (status === 'error') {
    return <ErrorState message={error || 'Unable to load this data.'} onRetry={onRetry} />;
  }
  if (rows.length === 0) {
    return <EmptyState title={emptyTitle} message={emptyMessage} action={emptyAction} icon={emptyIcon} />;
  }

  const currentSortField = sort ? sort.replace(/^-/, '') : null;
  const currentSortDir = sort?.startsWith('-') ? 'desc' : 'asc';

  const toggleSort = (column) => {
    if (!column.sortKey || !onSort) return;
    if (currentSortField === column.sortKey) {
      onSort(currentSortDir === 'asc' ? `-${column.sortKey}` : column.sortKey);
    } else {
      onSort(column.defaultDesc ? `-${column.sortKey}` : column.sortKey);
    }
  };

  const alignClass = (align) => (align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left');
  const primaryColumn = visibleColumns.find((c) => c.primary) || visibleColumns[0];

  return (
    <div className="relative">
      {isFetching && (
        <div className="absolute inset-x-0 top-0 z-20 h-0.5 overflow-hidden" aria-hidden="true">
          <div className="h-full w-1/3 animate-[shimmer_1s_linear_infinite] bg-primary-500" style={{ backgroundSize: '300% 100%' }} />
        </div>
      )}

      {/* Desktop / tablet */}
      <div className={clsx('hidden overflow-x-auto md:block', isFetching && 'opacity-70 transition-opacity')}>
        <table className="ui-table">
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead>
            <tr>
              {visibleColumns.map((column) => {
                const sortable = Boolean(column.sortKey && onSort);
                const active = sortable && currentSortField === column.sortKey;
                return (
                  <th
                    key={column.key}
                    scope="col"
                    style={column.width ? { width: column.width } : undefined}
                    aria-sort={active ? (currentSortDir === 'asc' ? 'ascending' : 'descending') : undefined}
                    className={clsx(alignClass(column.align), column.headerClassName)}
                  >
                    {sortable ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(column)}
                        className={clsx(
                          'group inline-flex items-center gap-1 rounded uppercase tracking-wide hover:text-slate-800 dark:hover:text-slate-100',
                          column.align === 'right' && 'flex-row-reverse',
                          active && 'text-slate-800 dark:text-slate-100'
                        )}
                      >
                        {column.header}
                        {active ? (
                          currentSortDir === 'asc' ? (
                            <ArrowUp size={12} aria-hidden="true" />
                          ) : (
                            <ArrowDown size={12} aria-hidden="true" />
                          )
                        ) : (
                          <ArrowUpDown size={12} aria-hidden="true" className="opacity-0 transition-opacity group-hover:opacity-60" />
                        )}
                      </button>
                    ) : (
                      column.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr
                key={rowKey(row) ?? index}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={clsx(onRowClick && 'cursor-pointer', typeof rowClassName === 'function' ? rowClassName(row) : rowClassName)}
              >
                {visibleColumns.map((column) => (
                  <td
                    key={column.key}
                    className={clsx(alignClass(column.align), dense && '!py-2', column.className, column.align === 'right' && 'tabular')}
                  >
                    {column.render ? column.render(row) : row[column.key] ?? '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          {footer && <tfoot>{footer}</tfoot>}
        </table>
      </div>

      {/* Phone: one card per row */}
      <ul className={clsx('divide-y divide-slate-100 md:hidden dark:divide-slate-800', isFetching && 'opacity-70')}>
        {rows.map((row, index) => {
          const actions = visibleColumns.find((c) => c.isActions);
          return (
            <li
              key={rowKey(row) ?? index}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={clsx('space-y-2 p-4', onRowClick && 'cursor-pointer active:bg-slate-50 dark:active:bg-slate-800/50')}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1 text-sm font-medium text-slate-900 dark:text-white">
                  {primaryColumn.render ? primaryColumn.render(row) : row[primaryColumn.key]}
                </div>
                {actions && <div className="shrink-0">{actions.render(row)}</div>}
              </div>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                {visibleColumns
                  .filter((c) => c !== primaryColumn && !c.isActions && !c.hideOnMobile)
                  .map((column) => (
                    <div key={column.key} className="min-w-0">
                      <dt className="text-[11px] uppercase tracking-wide text-slate-400">{column.mobileLabel || column.header}</dt>
                      <dd className="truncate text-slate-700 dark:text-slate-200">{column.render ? column.render(row) : row[column.key] ?? '—'}</dd>
                    </div>
                  ))}
              </dl>
            </li>
          );
        })}
      </ul>

      {pagination && <Pagination pagination={pagination} onPageChange={onPageChange} onPageSizeChange={onPageSizeChange} />}
    </div>
  );
}
