import { Link } from 'react-router-dom';
import { Users, UserCheck, CalendarClock, Clock3, UserX, ArrowRight, RefreshCw, CalendarRange } from 'lucide-react';
import { dashboardApi } from '../../api/dashboardApi';
import { useApiQuery } from '../../hooks/useApiQuery';
import { StatCard, Card, CardHeader, PageHeader, StatusBadge, Button, ErrorState, DashboardSkeleton, EmptyState, Avatar, DataTable } from '../../components/ui';
import { formatDate, formatTime, fullName } from '../../utils/format';
import QuickActions from '../../components/QuickActions';
import TodayBanner from './TodayBanner';

export default function ManagerDashboard() {
  const { data, status, error, refetch, isFetching } = useApiQuery((signal) => dashboardApi.manager({ signal }), []);

  if (status === 'loading') return <DashboardSkeleton stats={5} charts={2} />;
  if (status === 'error' || !data) return <ErrorState message={error || 'Unable to load the dashboard.'} onRetry={refetch} />;

  const teamColumns = [
    {
      key: 'name',
      header: 'Team member',
      primary: true,
      render: (m) => (
        <Link to={`/employees/${m._id}`} className="flex items-center gap-3 hover:underline">
          <Avatar src={m.profileImageUrl} name={fullName(m)} size={30} />
          <div className="min-w-0">
            <p className="truncate font-medium text-slate-800 dark:text-slate-100">{fullName(m)}</p>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">{m.designation?.name || m.employeeId}</p>
          </div>
        </Link>
      ),
    },
    { key: 'checkIn', header: 'Check in', render: (m) => formatTime(m.checkIn), className: 'text-slate-500 dark:text-slate-400' },
    { key: 'checkOut', header: 'Check out', render: (m) => formatTime(m.checkOut), className: 'text-slate-500 dark:text-slate-400' },
    { key: 'todayStatus', header: 'Today', render: (m) => <StatusBadge status={m.todayStatus} /> },
  ];

  return (
    <div>
      <PageHeader
        title="Team Dashboard"
        description="Your direct reports at a glance."
        actions={
          <Button variant="secondary" size="sm" icon={RefreshCw} onClick={refetch} loading={isFetching}>
            Refresh
          </Button>
        }
      />

      <QuickActions className="mb-5" />
      <TodayBanner today={data.today} />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-5">
        <StatCard label="Team size" value={data.teamSize} icon={Users} accent="primary" to="/employees" />
        <StatCard label="Present today" value={data.teamPresentToday} icon={UserCheck} accent="emerald" hint={data.teamSize ? `${Math.round((data.teamPresentToday / data.teamSize) * 100)}% of team` : undefined} />
        <StatCard
          label="Absent today"
          value={data.teamAbsentToday}
          icon={UserX}
          accent={data.today && !data.today.working ? 'slate' : 'red'}
          hint={data.today && !data.today.working ? (data.today.holiday ? 'Holiday' : 'Non-working day') : 'Not checked in'}
        />
        <StatCard label="On leave today" value={data.teamOnLeaveToday} icon={CalendarClock} accent="amber" hint={`${data.upcomingLeaves7d} starting in 7 days`} />
        <StatCard label="Pending approvals" value={data.pendingApprovals} icon={Clock3} accent={data.pendingApprovals > 0 ? 'amber' : 'slate'} to="/leaves/approvals" hint={data.pendingApprovals > 0 ? 'Awaiting your decision' : 'All caught up'} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <CardHeader
            title="Team today"
            description="Attendance for each direct report"
            actions={
              <Link to="/attendance/team" className="inline-flex items-center gap-1 text-xs font-medium text-primary-600 hover:underline dark:text-primary-400">
                Full attendance <ArrowRight size={13} aria-hidden="true" />
              </Link>
            }
          />
          <DataTable
            columns={teamColumns}
            rows={data.teamToday}
            emptyTitle="No direct reports yet"
            emptyMessage="Employees whose manager is set to you will appear here."
            emptyIcon={Users}
            dense
          />
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader
            title="Recent leave requests"
            actions={
              <Link to="/leaves/approvals" className="inline-flex items-center gap-1 text-xs font-medium text-primary-600 hover:underline dark:text-primary-400">
                View all <ArrowRight size={13} aria-hidden="true" />
              </Link>
            }
          />
          {data.recentLeaveRequests.length === 0 ? (
            <EmptyState compact icon={CalendarRange} title="No requests yet" message="Your team hasn't submitted any leave requests." />
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {data.recentLeaveRequests.map((leave) => (
                <li key={leave._id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-800 dark:text-slate-100">{fullName(leave.employee)}</p>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                      {leave.leaveType?.name} · {formatDate(leave.startDate)} – {formatDate(leave.endDate)} · {leave.days}d
                    </p>
                  </div>
                  <StatusBadge status={leave.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
