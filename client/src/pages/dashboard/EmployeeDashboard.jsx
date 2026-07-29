import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, CalendarDays, Wallet, CheckCircle2 } from 'lucide-react';
import { dashboardApi } from '../../api/dashboardApi';
import StatCard from '../../components/dashboard/StatCard';
import StatusBadge from '../../components/StatusBadge';
import { Loading, ErrorState, EmptyState } from '../../components/StateViews';

function formatDate(value) {
  return new Date(value).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function currency(value) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value || 0);
}

export default function EmployeeDashboard() {
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    dashboardApi
      .employee()
      .then(({ data }) => {
        setData(data.data);
        setStatus('ready');
      })
      .catch(() => setStatus('error'));
  }, []);

  if (status === 'loading') return <Loading label="Loading dashboard…" />;
  if (status === 'error' || !data) return <ErrorState message="Failed to load the dashboard." />;

  const checkInStatus = data.todayAttendance?.checkIn
    ? data.todayAttendance?.checkOut
      ? 'Checked out'
      : 'Checked in'
    : 'Not checked in';

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold text-slate-900 dark:text-white">My Dashboard</h1>
      <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">Your attendance, leave, and payroll at a glance.</p>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Today's Status" value={checkInStatus} icon={CheckCircle2} accent="indigo" />
        <StatCard label="Present Days (30d)" value={data.attendanceSummary.present} icon={Clock} accent="emerald" />
        <StatCard label="Leave Days (30d)" value={data.attendanceSummary.leave} icon={CalendarDays} accent="amber" />
        <StatCard
          label="Latest Net Salary"
          value={data.latestPayroll ? currency(data.latestPayroll.netSalary) : '—'}
          icon={Wallet}
          accent="indigo"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-200 p-4 dark:border-slate-800">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Leave Balance</h3>
            <Link to="/leaves" className="text-xs text-indigo-600 hover:underline dark:text-indigo-400">
              Apply for leave
            </Link>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {data.leaveBalance.map((lb) => (
              <div key={lb.leaveType} className="flex items-center justify-between px-4 py-3 text-sm">
                <span className="text-slate-600 dark:text-slate-300">{lb.leaveType}</span>
                <span className="font-medium text-slate-900 dark:text-white">
                  {lb.remaining} / {lb.allocated} days left
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-200 p-4 dark:border-slate-800">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Recent Leave Requests</h3>
            <Link to="/leaves" className="text-xs text-indigo-600 hover:underline dark:text-indigo-400">
              View all
            </Link>
          </div>
          {data.recentLeaveRequests.length === 0 ? (
            <EmptyState title="No requests yet" message="Your leave requests will show up here." />
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {data.recentLeaveRequests.map((leave) => (
                <div key={leave._id} className="flex items-center justify-between px-4 py-3 text-sm">
                  <div>
                    <p className="font-medium text-slate-800 dark:text-slate-100">{leave.leaveType?.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {formatDate(leave.startDate)} – {formatDate(leave.endDate)}
                    </p>
                  </div>
                  <StatusBadge status={leave.status} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
