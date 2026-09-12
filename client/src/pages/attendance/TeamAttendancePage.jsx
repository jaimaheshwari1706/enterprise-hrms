import { useState } from 'react';
import { Download, Users2 } from 'lucide-react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { employeeApi } from '../../api/employeeApi';
import { attendanceApi } from '../../api/attendanceApi';
import { exportApi } from '../../api/exportApi';
import { selectCurrentUser } from '../../features/auth/authSlice';
import { useToast } from '../../hooks/useToast';
import { useApiQuery } from '../../hooks/useApiQuery';
import { useListParams } from '../../hooks/useListParams';
import { Button, Card, PageHeader, DataTable, StatusBadge, Avatar, Input, Select, Toolbar, NoResults } from '../../components/ui';
import { formatDate, formatTime, formatHours, fullName, todayInputValue } from '../../utils/format';
import { getApiErrorMessage } from '../../utils/apiError';

export default function TeamAttendancePage() {
  const user = useSelector(selectCurrentUser);
  const canExport = user?.role === 'HR_ADMIN' || user?.role === 'SUPER_ADMIN';
  const { showToast } = useToast();
  const [exporting, setExporting] = useState(false);

  const list = useListParams({ pageSize: 10, sort: '-date', filters: { employee: '', status: '', from: '', to: '' } });
  const records = useApiQuery((signal) => attendanceApi.list(list.params, { signal }), [JSON.stringify(list.params)]);
  const employees = useApiQuery((signal) => employeeApi.options({ signal }), []);

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportApi.attendance({
        employee: list.filters.employee || undefined,
        status: list.filters.status || undefined,
        from: list.filters.from || undefined,
        to: list.filters.to || undefined,
      });
      showToast('Attendance export downloaded');
    } catch (err) {
      showToast(getApiErrorMessage(err, 'Unable to export attendance.'), 'error');
    } finally {
      setExporting(false);
    }
  };

  const setToday = () => {
    const today = todayInputValue();
    list.setFilters({ from: today, to: today });
  };

  const columns = [
    {
      key: 'employee',
      header: 'Employee',
      primary: true,
      render: (rec) => (
        <Link to={`/employees/${rec.employee?._id}`} className="flex items-center gap-3 hover:underline">
          <Avatar src={rec.employee?.profileImageUrl} name={fullName(rec.employee)} size={30} />
          <div className="min-w-0">
            <p className="truncate font-medium text-slate-900 dark:text-white">{fullName(rec.employee) || 'Unknown'}</p>
            <p className="truncate font-mono text-xs text-slate-500 dark:text-slate-400">{rec.employee?.employeeId}</p>
          </div>
        </Link>
      ),
    },
    { key: 'date', header: 'Date', sortKey: 'date', defaultDesc: true, render: (rec) => formatDate(rec.date, { weekday: 'short' }), className: 'text-slate-600 tabular dark:text-slate-300' },
    { key: 'checkIn', header: 'Check in', render: (rec) => formatTime(rec.checkIn), className: 'text-slate-600 tabular dark:text-slate-300' },
    { key: 'checkOut', header: 'Check out', render: (rec) => formatTime(rec.checkOut), className: 'text-slate-600 tabular dark:text-slate-300' },
    { key: 'workingHours', header: 'Hours', sortKey: 'workingHours', align: 'right', render: (rec) => formatHours(rec.workingHours), className: 'text-slate-600 dark:text-slate-300' },
    { key: 'status', header: 'Status', sortKey: 'status', render: (rec) => <StatusBadge status={rec.status} /> },
  ];

  return (
    <div>
      <PageHeader
        title="Team Attendance"
        description={user?.role === 'MANAGER' ? 'Attendance records for your direct reports.' : 'Attendance records across the organization.'}
        actions={
          canExport && (
            <Button variant="secondary" icon={Download} onClick={handleExport} loading={exporting}>
              Export
            </Button>
          )
        }
      />

      <Toolbar
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={setToday}>
              Today
            </Button>
            {list.hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={list.resetFilters}>
                Clear filters
              </Button>
            )}
          </>
        }
      >
        <Select value={list.filters.employee} onChange={(e) => list.setFilter('employee', e.target.value)} aria-label="Filter by employee" className="w-full sm:w-56">
          <option value="">All employees</option>
          {(employees.data || []).map((e) => (
            <option key={e._id} value={e._id}>
              {fullName(e)} ({e.employeeId})
            </option>
          ))}
        </Select>
        <Select value={list.filters.status} onChange={(e) => list.setFilter('status', e.target.value)} aria-label="Filter by status" className="w-full sm:w-40">
          <option value="">All statuses</option>
          <option value="Present">Present</option>
          <option value="HalfDay">Half day</option>
          <option value="Leave">On leave</option>
          <option value="Absent">Absent</option>
        </Select>
        <Input type="date" value={list.filters.from} max={list.filters.to || undefined} onChange={(e) => list.setFilter('from', e.target.value)} aria-label="From date" className="w-full sm:w-40" />
        <Input type="date" value={list.filters.to} min={list.filters.from || undefined} onChange={(e) => list.setFilter('to', e.target.value)} aria-label="To date" className="w-full sm:w-40" />
      </Toolbar>

      <Card>
        {records.status === 'ready' && records.data?.length === 0 && list.hasActiveFilters ? (
          <NoResults onClear={list.resetFilters} />
        ) : (
          <DataTable
            caption="Team attendance"
            columns={columns}
            rows={records.data || []}
            status={records.status}
            isFetching={records.isFetching}
            error={records.error}
            onRetry={records.refetch}
            sort={list.sort}
            onSort={list.setSort}
            pagination={records.pagination}
            onPageChange={list.setPage}
            onPageSizeChange={list.setPageSize}
            emptyIcon={Users2}
            emptyTitle="No attendance records yet"
            emptyMessage="Records appear here as your team checks in."
          />
        )}
      </Card>
    </div>
  );
}
