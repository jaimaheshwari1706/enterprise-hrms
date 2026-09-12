import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Clock, CalendarDays, Wallet, LogIn, LogOut, ArrowRight, CalendarRange, Timer } from 'lucide-react';
import { dashboardApi } from '../../api/dashboardApi';
import { attendanceApi } from '../../api/attendanceApi';
import { useApiQuery } from '../../hooks/useApiQuery';
import { useToast } from '../../hooks/useToast';
import { selectCurrentUser } from '../../features/auth/authSlice';
import {
  StatCard, Card, CardHeader, PageHeader, StatusBadge, Button, ErrorState, DashboardSkeleton, EmptyState, ProgressBar, Alert,
} from '../../components/ui';
import { formatCurrency, formatDate, formatMonth, formatTime, formatHours, fullName } from '../../utils/format';
import { getApiErrorMessage } from '../../utils/apiError';
import QuickActions from '../../components/QuickActions';
import TodayBanner from './TodayBanner';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function EmployeeDashboard() {
  const user = useSelector(selectCurrentUser);
  const { showToast } = useToast();
  const [acting, setActing] = useState(null); // 'in' | 'out'
  const { data, status, error, refetch } = useApiQuery((signal) => dashboardApi.employee({ signal }), [], { enabled: Boolean(user?.employee) });

  if (!user?.employee) {
    return (
      <div>
        <PageHeader title={`${greeting()}, ${user?.email}`} description="Your account is not linked to an employee profile." />
        <Alert tone="info" title="No employee profile linked">
          Attendance, leave and payroll need an employee record. Ask HR to link one to this account.
        </Alert>
      </div>
    );
  }

  if (status === 'loading') return <DashboardSkeleton stats={4} charts={2} />;
  if (status === 'error' || !data) return <ErrorState message={error || 'Unable to load your dashboard.'} onRetry={refetch} />;

  const today = data.todayAttendance;
  const hasCheckedIn = Boolean(today?.checkIn);
  const hasCheckedOut = Boolean(today?.checkOut);
  const todayStatus = hasCheckedOut ? 'Checked out' : hasCheckedIn ? 'Checked in' : today?.status === 'Leave' ? 'On leave' : 'Not checked in';

  const act = async (kind) => {
    setActing(kind);
    try {
      await (kind === 'in' ? attendanceApi.checkIn() : attendanceApi.checkOut());
      showToast(kind === 'in' ? 'Checked in. Have a good day!' : 'Checked out. See you tomorrow!');
      refetch();
    } catch (err) {
      showToast(getApiErrorMessage(err), 'error');
    } finally {
      setActing(null);
    }
  };

  return (
    <div>
      <PageHeader title={`${greeting()}, ${user.employee.firstName}`} description="Your attendance, leave and payroll at a glance." />

      <QuickActions className="mb-5" />
      <TodayBanner today={data.today} />

      <Card className="mb-6">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-600 dark:bg-primary-500/10 dark:text-primary-300">
              <Clock size={22} aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Today · {formatDate(new Date(), { timeZone: undefined })}
                {data.today && !data.today.working && <span> · {data.today.holiday || 'Non-working day'}</span>}
              </p>
              <div className="mt-0.5 flex flex-wrap items-center gap-2">
                <StatusBadge status={todayStatus} size="md" />
                {hasCheckedIn && <span className="text-sm text-slate-600 dark:text-slate-300">In at {formatTime(today.checkIn)}</span>}
                {hasCheckedOut && <span className="text-sm text-slate-600 dark:text-slate-300">· Out at {formatTime(today.checkOut)} · {formatHours(today.workingHours)}</span>}
              </div>
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
      </Card>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard
          label="Present days · 30d"
          value={data.attendanceSummary.present}
          icon={Clock}
          accent="emerald"
          hint={`${data.attendanceSummary.halfDay} half day${data.attendanceSummary.halfDay === 1 ? '' : 's'} · ${data.attendanceSummary.absent} absent of ${data.attendanceSummary.workingDays} working days`}
          to="/attendance"
        />
        <StatCard label="Avg. hours / day" value={formatHours(data.attendanceSummary.averageHours)} icon={Timer} accent="sky" hint={`${formatHours(data.attendanceSummary.totalHours)} in 30 days`} />
        <StatCard label="Leave days · 30d" value={data.attendanceSummary.leave} icon={CalendarDays} accent="amber" hint={data.upcomingLeave ? `Next: ${formatDate(data.upcomingLeave.startDate)}` : 'No upcoming leave'} to="/leaves" />
        <StatCard
          label="Latest payslip"
          value={data.latestPayroll ? formatCurrency(data.latestPayroll.netSalary) : '—'}
          icon={Wallet}
          accent="primary"
          hint={data.latestPayroll ? `${formatMonth(data.latestPayroll.month)} · ${data.latestPayroll.status}` : 'No payslip yet'}
          to="/payroll"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Leave balance"
            description="This year's allocation, including pending requests"
            actions={
              <Link to="/leaves" className="inline-flex items-center gap-1 text-xs font-medium text-primary-600 hover:underline dark:text-primary-400">
                Apply for leave <ArrowRight size={13} aria-hidden="true" />
              </Link>
            }
          />
          {data.leaveBalance.length === 0 ? (
            <EmptyState compact title="No leave types configured" message="HR hasn't set up leave types yet." />
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {data.leaveBalance.map((lb) => {
                const consumed = lb.used + lb.pending;
                return (
                  <li key={lb.leaveType} className="px-5 py-3">
                    <div className="mb-1.5 flex items-center justify-between text-sm">
                      <span className="text-slate-700 dark:text-slate-200">{lb.leaveType}</span>
                      <span className="font-medium text-slate-900 tabular dark:text-white">
                        {lb.remaining} <span className="text-xs font-normal text-slate-400">/ {lb.allocated} left</span>
                      </span>
                    </div>
                    <ProgressBar value={consumed} max={lb.allocated} tone={lb.remaining === 0 ? 'danger' : consumed / lb.allocated > 0.75 ? 'warning' : 'primary'} label={`${lb.leaveType} used`} />
                    <p className="mt-1 text-[11px] text-slate-400">
                      {lb.used} used{lb.pending ? ` · ${lb.pending} pending` : ''}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Recent leave requests"
            actions={
              <Link to="/leaves" className="inline-flex items-center gap-1 text-xs font-medium text-primary-600 hover:underline dark:text-primary-400">
                View all <ArrowRight size={13} aria-hidden="true" />
              </Link>
            }
          />
          {data.recentLeaveRequests.length === 0 ? (
            <EmptyState compact icon={CalendarRange} title="No requests yet" message="Your leave requests will show up here." action={<Link to="/leaves"><Button size="sm" variant="secondary">Apply for leave</Button></Link>} />
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {data.recentLeaveRequests.map((leave) => (
                <li key={leave._id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-800 dark:text-slate-100">{leave.leaveType?.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {formatDate(leave.startDate)} – {formatDate(leave.endDate)} · {leave.days} day{leave.days === 1 ? '' : 's'}
                    </p>
                  </div>
                  <StatusBadge status={leave.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <p className="sr-only">Signed in as {fullName(user.employee)}</p>
    </div>
  );
}
