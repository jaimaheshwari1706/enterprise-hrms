import clsx from 'clsx';

// Building blocks for loading states. All skeletons are aria-hidden and
// wrapped in a container that announces "Loading" once.
export function Skeleton({ className = '', style }) {
  return <div aria-hidden="true" className={clsx('ui-skeleton', className)} style={style} />;
}

export function SkeletonText({ lines = 3, className = '' }) {
  return (
    <div className={clsx('space-y-2', className)} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className="h-3" style={{ width: `${100 - (i % 3) * 18}%` }} />
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 6, columns = 4 }) {
  return (
    <div role="status" aria-label="Loading" className="animate-fade-in">
      <div className="hidden md:block">
        <div className="flex gap-4 border-b border-slate-100 bg-slate-50/60 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/40">
          {Array.from({ length: columns }).map((_, i) => (
            <Skeleton key={i} className="h-3 flex-1" />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex items-center gap-4 border-b border-slate-100 px-4 py-3.5 last:border-0 dark:border-slate-800">
            {Array.from({ length: columns }).map((_, c) => (
              <div key={c} className="flex flex-1 items-center gap-3">
                {c === 0 && <Skeleton className="h-8 w-8 shrink-0 rounded-full" />}
                <Skeleton className="h-3" style={{ width: `${55 + ((r + c) % 3) * 15}%` }} />
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="space-y-3 p-4 md:hidden">
        {Array.from({ length: Math.min(rows, 4) }).map((_, r) => (
          <div key={r} className="space-y-2 rounded-lg border border-slate-100 p-3 dark:border-slate-800">
            <Skeleton className="h-3.5 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        ))}
      </div>
      <span className="sr-only">Loading</span>
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="ui-card p-5" aria-hidden="true">
      <div className="flex items-center justify-between">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-9 w-9 rounded-lg" />
      </div>
      <Skeleton className="mt-4 h-7 w-20" />
      <Skeleton className="mt-2 h-3 w-32" />
    </div>
  );
}

export function ChartSkeleton({ height = 260 }) {
  return (
    <div className="flex items-end gap-2 px-2 pt-6" style={{ height }} aria-hidden="true">
      {[45, 70, 55, 85, 60, 75, 50, 65, 80, 58, 72, 48].map((h, i) => (
        <Skeleton key={i} className="flex-1 rounded-t-md rounded-b-none" style={{ height: `${h}%` }} />
      ))}
    </div>
  );
}

export function CardSkeleton({ lines = 4 }) {
  return (
    <div className="ui-card p-5" aria-hidden="true">
      <Skeleton className="mb-4 h-4 w-40" />
      <SkeletonText lines={lines} />
    </div>
  );
}

export function FormSkeleton({ fields = 6 }) {
  return (
    <div className="ui-card p-5" role="status" aria-label="Loading">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {Array.from({ length: fields }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-9 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function DashboardSkeleton({ stats = 6, charts = 4 }) {
  return (
    <div role="status" aria-label="Loading dashboard" className="animate-fade-in">
      <div className="mb-6 space-y-2">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-3 w-72" />
      </div>
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: stats }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {Array.from({ length: charts }).map((_, i) => (
          <div key={i} className="ui-card p-5">
            <Skeleton className="mb-2 h-4 w-44" />
            <ChartSkeleton />
          </div>
        ))}
      </div>
    </div>
  );
}

// Route-transition fallback: a slim indeterminate bar at the top of the
// content area instead of a blank page.
export function PageSkeleton() {
  return (
    <div role="status" aria-label="Loading page" className="animate-fade-in">
      <div className="mb-6 space-y-2">
        <Skeleton className="h-6 w-56" />
        <Skeleton className="h-3 w-80" />
      </div>
      <div className="ui-card">
        <TableSkeleton rows={5} columns={4} />
      </div>
    </div>
  );
}

// Full-screen splash while the session is being restored on first load.
export function AppSplash() {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4 bg-slate-50 dark:bg-slate-950" role="status" aria-label="Loading application">
      <div className="flex items-center gap-2.5">
        <BrandMark />
        <span className="text-base font-semibold text-slate-900 dark:text-white">Enterprise HRMS</span>
      </div>
      <div className="h-1 w-40 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
        <div className="h-full w-1/2 animate-[shimmer_1.2s_linear_infinite] rounded-full bg-primary-500" style={{ backgroundSize: '200% 100%' }} />
      </div>
    </div>
  );
}

export function BrandMark({ className = 'h-8 w-8' }) {
  return (
    <div className={clsx('flex shrink-0 items-center justify-center rounded-lg bg-primary-600 text-white shadow-xs', className)} aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" className="h-[60%] w-[60%]" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 20V9l8-5 8 5v11" />
        <path d="M9 20v-6h6v6" />
      </svg>
    </div>
  );
}
