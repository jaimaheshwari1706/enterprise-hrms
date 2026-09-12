import { lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { Users, UserCheck, UserX, CalendarClock, Clock3, Wallet, UserPlus, ArrowRight, RefreshCw } from 'lucide-react';
import { dashboardApi } from '../../api/dashboardApi';
import { useApiQuery } from '../../hooks/useApiQuery';
import {
  StatCard, Card, CardHeader, PageHeader, StatusBadge, Badge, Button, ErrorState, DashboardSkeleton, ChartSkeleton,
  EmptyState, ProgressBar, Avatar, Tooltip,
} from '../../components/ui';
import { formatCurrency, formatMonth, timeAgo } from '../../utils/format';
import QuickActions from '../../components/QuickActions';
import TodayBanner from './TodayBanner';

const HRDashboardCharts = lazy(() => import('./HRDashboardCharts'));

const ACTION_LABELS = {
  LOGIN: 'signed in',
  CREATE_EMPLOYEE: 'added an employee',
  UPDATE_EMPLOYEE: 'updated an employee',
  ACTIVATE_EMPLOYEE: 'activated an employee',
  DEACTIVATE_EMPLOYEE: 'deactivated an employee',
  APPLY_LEAVE: 'applied for leave',
  APPROVE_LEAVE: 'approved a leave request',
  REJECT_LEAVE: 'rejected a leave request',
  CANCEL_LEAVE: 'cancelled a leave request',
  GENERATE_PAYROLL: 'generated payroll',
  UPDATE_PAYROLL_STATUS: 'updated a payroll status',
  UPDATE_SALARY: 'updated a salary structure',
  CREATE_DEPARTMENT: 'created a department',
  UPDATE_DEPARTMENT: 'updated a department',
  DELETE_DEPARTMENT: 'deleted a department',
  CREATE_DESIGNATION: 'created a designation',
  UPDATE_DESIGNATION: 'updated a designation',
  DELETE_DESIGNATION: 'deleted a designation',
  UPDATE_ORGANIZATION: 'updated organization settings',
  UPDATE_PROFILE: 'updated their profile',
  CHANGE_PASSWORD: 'changed their password',
  RESET_PASSWORD: 'reset their password',
};

function ChartsFallback() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="ui-card p-5">
          <ChartSkeleton />
        </div>
      ))}
    </div>
  );
}

export default function HRDashboard() {
  const { data, status, error, refetch, isFetching } = useApiQuery((signal) => dashboardApi.hr({ signal }), []);

  if (status === 'loading') return <DashboardSkeleton />;
  if (status === 'error' || !data) return <ErrorState message={error || 'Unable to load the dashboard.'} onRetry={refetch} />;

  const { charts, payroll, today } = data;
  const nonWorking = today && !today.working;
  const attendanceRate = data.activeEmployees ? Math.round((data.presentToday / data.activeEmployees) * 100) : 0;
  const payrollProgress = payroll.eligibleEmployees ? Math.round((payroll.records / payroll.eligibleEmployees) * 100) : 0;

  return (
    <div>
      <PageHeader
        title="HR Dashboard"
        description="How the organization looks right now."
        actions={
          <Button variant="secondary" size="sm" icon={RefreshCw} onClick={refetch} loading={isFetching}>
            Refresh
          </Button>
        }
      />

      <QuickActions className="mb-5" />
      <TodayBanner today={today} />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Total employees" value={data.totalEmployees} icon={Users} accent="primary" hint={`${data.inactiveEmployees} inactive`} to="/employees" />
        <StatCard label="Active" value={data.activeEmployees} icon={UserCheck} accent="emerald" hint={`${data.newJoiners30d} joined in 30 days`} to="/employees?status=active" />
        <StatCard label="Present today" value={data.presentToday} icon={UserCheck} accent="emerald" hint={`${attendanceRate}% of active`} to="/attendance/team" />
        <StatCard
          label="Absent today"
          value={data.absentToday}
          icon={UserX}
          accent={nonWorking ? 'slate' : 'red'}
          hint={nonWorking ? (today.holiday ? 'Holiday' : 'Non-working day') : data.halfDayToday ? `${data.halfDayToday} half day` : 'Not checked in'}
          to="/attendance/team"
        />
        <StatCard label="On leave today" value={data.onLeaveToday} icon={CalendarClock} accent="amber" hint="Approved leave" to="/leaves/approvals?status=Approved" />
        <StatCard label="Pending approvals" value={data.pendingApprovals} icon={Clock3} accent={data.pendingApprovals > 0 ? 'amber' : 'slate'} hint={data.pendingApprovals > 0 ? 'Awaiting a decision' : 'All caught up'} to="/leaves/approvals" />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-1">
          <CardHeader
            title={`Payroll · ${formatMonth(payroll.month)}`}
            actions={<StatusBadge status={payroll.status} />}
          />
          <div className="p-5">
            <p className="text-2xl font-semibold tracking-tight text-slate-900 tabular dark:text-white">{formatCurrency(data.monthlyPayrollTotal)}</p>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Net payroll generated this month</p>
            <div className="mt-4">
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400">Payslips generated</span>
                <span className="font-medium text-slate-700 tabular dark:text-slate-200">
                  {payroll.records} / {payroll.eligibleEmployees}
                </span>
              </div>
              <ProgressBar value={payroll.records} max={payroll.eligibleEmployees} tone={payrollProgress === 100 ? 'success' : 'primary'} label="Payslips generated" />
            </div>
            <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
              {['Draft', 'Processed', 'Paid'].map((s) => (
                <div key={s} className="rounded-lg bg-slate-50 px-2 py-2 dark:bg-slate-800/60">
                  <dt className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">{s}</dt>
                  <dd className="text-base font-semibold text-slate-900 tabular dark:text-white">{payroll.byStatus[s] || 0}</dd>
                </div>
              ))}
            </dl>
            <Link to="/payroll/manage" className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-primary-600 hover:underline dark:text-primary-400">
              Manage payroll <ArrowRight size={13} aria-hidden="true" />
            </Link>
          </div>
        </Card>

        <Card className="xl:col-span-1">
          <CardHeader title="Leave overview" description="All-time request status and this year's usage" />
          <div className="p-5">
            <div className="flex flex-wrap gap-2">
              {['Pending', 'Approved', 'Rejected', 'Cancelled'].map((s) => {
                const count = charts.leaveStatusBreakdown.find((r) => r.status === s)?.count || 0;
                return (
                  <Link key={s} to={`/leaves/approvals?status=${s}`} className="flex items-center gap-2 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/60">
                    <StatusBadge status={s} />
                    <span className="font-semibold text-slate-800 tabular dark:text-slate-100">{count}</span>
                  </Link>
                );
              })}
            </div>
            <table className="mt-4 w-full text-xs">
              <caption className="sr-only">Approved leave days this year by type</caption>
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400">
                  <th scope="col" className="pb-1.5 font-medium">Leave type</th>
                  <th scope="col" className="pb-1.5 text-right font-medium">Days used</th>
                  <th scope="col" className="pb-1.5 text-right font-medium">Requests</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {charts.leaveUtilization.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-3 text-center text-slate-400">No leave types configured</td>
                  </tr>
                )}
                {charts.leaveUtilization.map((row) => (
                  <tr key={row.leaveType}>
                    <td className="py-2 text-slate-700 dark:text-slate-200">
                      {row.leaveType} <span className="text-slate-400">· {row.allocatedPerEmployee}/yr</span>
                    </td>
                    <td className="py-2 text-right font-medium text-slate-800 tabular dark:text-slate-100">{row.approvedDays}</td>
                    <td className="py-2 text-right text-slate-500 tabular dark:text-slate-400">{row.approvedRequests}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="xl:col-span-1">
          <CardHeader title="Workforce mix" description="Active employees by employment type" />
          <div className="space-y-3 p-5">
            {charts.employmentTypeDistribution.length === 0 ? (
              <EmptyState compact icon={UserPlus} title="No active employees" message="Add your first employee to see the mix." />
            ) : (
              charts.employmentTypeDistribution.map((row) => (
                <div key={row.type}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-slate-700 dark:text-slate-200">{row.type}</span>
                    <span className="font-medium text-slate-800 tabular dark:text-slate-100">
                      {row.count}
                      <span className="ml-1 text-slate-400">({data.activeEmployees ? Math.round((row.count / data.activeEmployees) * 100) : 0}%)</span>
                    </span>
                  </div>
                  <ProgressBar value={row.count} max={data.activeEmployees} label={row.type} />
                </div>
              ))
            )}
            <Link to="/employees" className="inline-flex items-center gap-1 pt-1 text-xs font-medium text-primary-600 hover:underline dark:text-primary-400">
              View all employees <ArrowRight size={13} aria-hidden="true" />
            </Link>
          </div>
        </Card>
      </div>

      <Suspense fallback={<ChartsFallback />}>
        <HRDashboardCharts charts={charts} />
      </Suspense>

      <Card className="mt-6">
        <CardHeader
          title="Recent activity"
          description="Latest actions recorded in the audit log"
          actions={
            <Link to="/audit-logs" className="inline-flex items-center gap-1 text-xs font-medium text-primary-600 hover:underline dark:text-primary-400">
              View audit log <ArrowRight size={13} aria-hidden="true" />
            </Link>
          }
        />
        {data.recentActivity.length === 0 ? (
          <EmptyState compact title="No activity yet" message="Actions like logins, approvals and payroll runs will show up here." />
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {data.recentActivity.map((item) => (
              <li key={item.id} className="flex items-start gap-3 px-5 py-3">
                <Avatar name={item.user?.email || 'System'} size={30} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-800 dark:text-slate-100">
                    <span className="font-medium">{item.user?.email || 'System'}</span>{' '}
                    <span className="text-slate-600 dark:text-slate-300">{ACTION_LABELS[item.action] || item.action.toLowerCase().replace(/_/g, ' ')}</span>
                  </p>
                  {item.description && <p className="truncate text-xs text-slate-500 dark:text-slate-400">{item.description}</p>}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <Tooltip text={new Date(item.createdAt).toLocaleString()}>
                    <span className="text-[11px] text-slate-400">{timeAgo(item.createdAt)}</span>
                  </Tooltip>
                  <Badge>{item.entityType}</Badge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <p className="mt-4 text-right text-[11px] text-slate-400">
        Updated {timeAgo(data.generatedAt)} · <Wallet size={11} className="inline" aria-hidden="true" /> amounts in net terms
      </p>
    </div>
  );
}
