import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { LogIn, LogOut, Clock, CalendarDays } from 'lucide-react';
import { attendanceApi } from '../../api/attendanceApi';
import { selectCurrentUser } from '../../features/auth/authSlice';
import { useToast } from '../../hooks/useToast';
import { useApiQuery } from '../../hooks/useApiQuery';
import { useListParams } from '../../hooks/useListParams';
import { Button, Card, CardHeader, PageHeader, DataTable, StatusBadge, Input, Select, Toolbar, Alert, Skeleton, ErrorState, NoResults } from '../../components/ui';
import { formatDate, formatTime, formatHours } from '../../utils/format';
import { getApiErrorMessage } from '../../utils/apiError';

// Live "hours so far" since check-in, ticking once a minute.
function useElapsedHours(checkIn, stopAt) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!checkIn || stopAt) return undefined;
    const id = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(id);
  }, [checkIn, stopAt]);
  if (!checkIn) return 0;
  const end = stopAt ? new Date(stopAt).getTime() : now;
  return Math.max(0, (end - new Date(checkIn).getTime()) / 3600000);
}

export default function AttendancePage() {
  const user = useSelector(selectCurrentUser);
  const { showToast } = useToast();
  const [acting, setActing] = useState(null);
  const hasProfile = Boolean(user?.employee);

  const today = useApiQuery((signal) => attendanceApi.today({ signal }), [], { enabled: hasProfile });
  const list = useListParams({ pageSize: 10, sort: '-date', filters: { status: '', from: '', to: '' } });
  const history = useApiQuery((signal) => attendanceApi.myHistory(list.params, { signal }), [JSON.stringify(list.params)], { enabled: hasProfile });

  const record = today.data;
  const hasCheckedIn = Boolean(record?.checkIn);
  const hasCheckedOut = Boolean(record?.checkOut);
  const elapsed = useElapsedHours(record?.checkIn, record?.checkOut);

  const act = async (kind) => {
    setActing(kind);
    try {
      await (kind === 'in' ? attendanceApi.checkIn() : attendanceApi.checkOut());
      showToast(kind === 'in' ? 'Checked in successfully' : 'Checked out successfully');
      today.refetch();
      history.refetch();
    } catch (err) {
      showToast(getApiErrorMessage(err), 'error');
    } finally {
      setActing(null);
    }
  };

  const columns = [
    { key: 'date', header: 'Date', sortKey: 'date', defaultDesc: true, primary: true, render: (rec) => <span className="font-medium text-slate-900 dark:text-white">{formatDate(rec.date, { weekday: 'short' })}</span> },
    { key: 'checkIn', header: 'Check in', render: (rec) => formatTime(rec.checkIn), className: 'text-slate-600 tabular dark:text-slate-300' },
    { key: 'checkOut', header: 'Check out', render: (rec) => formatTime(rec.checkOut), className: 'text-slate-600 tabular dark:text-slate-300' },
    { key: 'workingHours', header: 'Hours', sortKey: 'workingHours', align: 'right', render: (rec) => formatHours(rec.workingHours), className: 'text-slate-600 dark:text-slate-300' },
    { key: 'status', header: 'Status', sortKey: 'status', render: (rec) => <StatusBadge status={rec.status} /> },
  ];

  if (!hasProfile) {
    return (
      <div>
        <PageHeader title="Attendance" description="Track your daily check-in and check-out." />
        <Alert tone="info" title="No employee profile linked">
          Attendance is recorded against an employee record. Ask HR to link one to this account.
        </Alert>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Attendance" description="Track your daily check-in and check-out." />

      <Card className="mb-6">
        {today.status === 'loading' ? (
          <div className="flex items-center gap-4 p-5">
            <Skeleton className="h-12 w-12 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-40" />
              <Skeleton className="h-4 w-64" />
            </div>
          </div>
        ) : today.status === 'error' ? (
          <ErrorState compact message={today.error} onRetry={today.refetch} />
        ) : (
          <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-600 dark:bg-primary-500/10 dark:text-primary-300">
                <Clock size={22} aria-hidden="true" />
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Today · {formatDate(new Date(), { timeZone: undefined, weekday: 'long' })}</p>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-700 dark:text-slate-200">
                  <StatusBadge status={hasCheckedOut ? 'Checked out' : hasCheckedIn ? 'Checked in' : record?.status === 'Leave' ? 'Leave' : 'Not checked in'} size="md" />
                  {hasCheckedIn && <span>In at {formatTime(record.checkIn)}</span>}
                  {hasCheckedOut ? (
                    <span>· Out at {formatTime(record.checkOut)} · {formatHours(record.workingHours)} worked</span>
                  ) : hasCheckedIn ? (
                    <span className="text-slate-500 dark:text-slate-400">· {formatHours(elapsed)} so far</span>
                  ) : null}
                </div>
                {hasCheckedIn && !hasCheckedOut && elapsed < 8 && (
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">A full day is 8 hours; checking out earlier records a half day.</p>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <Button icon={LogIn} onClick={() => act('in')} disabled={hasCheckedIn} loading={acting === 'in'}>
                Check in
              </Button>
              <Button variant="secondary" icon={LogOut} onClick={() => act('out')} disabled={!hasCheckedIn || hasCheckedOut} loading={acting === 'out'}>
                Check out
              </Button>
            </div>
          </div>
        )}
      </Card>

      <Card>
        <CardHeader title="History" description="Your attendance records, newest first" />
        <div className="px-5 pt-4">
          <Toolbar className="mb-3">
            <Select value={list.filters.status} onChange={(e) => list.setFilter('status', e.target.value)} aria-label="Filter by status" className="w-full sm:w-40">
              <option value="">All statuses</option>
              <option value="Present">Present</option>
              <option value="HalfDay">Half day</option>
              <option value="Leave">On leave</option>
              <option value="Absent">Absent</option>
            </Select>
            <Input type="date" value={list.filters.from} max={list.filters.to || undefined} onChange={(e) => list.setFilter('from', e.target.value)} aria-label="From date" className="w-full sm:w-40" />
            <Input type="date" value={list.filters.to} min={list.filters.from || undefined} onChange={(e) => list.setFilter('to', e.target.value)} aria-label="To date" className="w-full sm:w-40" />
            {list.hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={list.resetFilters}>
                Clear
              </Button>
            )}
          </Toolbar>
        </div>
        {history.status === 'ready' && history.data?.length === 0 && list.hasActiveFilters ? (
          <NoResults onClear={list.resetFilters} />
        ) : (
          <DataTable
            caption="Attendance history"
            columns={columns}
            rows={history.data || []}
            status={history.status}
            isFetching={history.isFetching}
            error={history.error}
            onRetry={history.refetch}
            sort={list.sort}
            onSort={list.setSort}
            pagination={history.pagination}
            onPageChange={list.setPage}
            onPageSizeChange={list.setPageSize}
            emptyIcon={CalendarDays}
            emptyTitle="No attendance records yet"
            emptyMessage="Check in for the first time to start building your history."
          />
        )}
      </Card>
    </div>
  );
}
