import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, UserCheck, CalendarClock, Clock3 } from 'lucide-react';
import { dashboardApi } from '../../api/dashboardApi';
import StatCard from '../../components/dashboard/StatCard';
import StatusBadge from '../../components/StatusBadge';
import { Loading, ErrorState, EmptyState } from '../../components/StateViews';

function formatDate(value) {
  return new Date(value).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function ManagerDashboard() {
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    dashboardApi
      .manager()
      .then(({ data }) => {
        setData(data.data);
        setStatus('ready');
      })
      .catch(() => setStatus('error'));
  }, []);

  if (status === 'loading') return <Loading label="Loading dashboard…" />;
  if (status === 'error' || !data) return <ErrorState message="Failed to load the dashboard." />;

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold text-slate-900 dark:text-white">Manager Dashboard</h1>
      <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">An overview of your team.</p>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Team Size" value={data.teamSize} icon={Users} accent="indigo" />
        <StatCard label="Present Today" value={data.teamPresentToday} icon={UserCheck} accent="emerald" />
        <StatCard label="On Leave Today" value={data.teamOnLeaveToday} icon={CalendarClock} accent="amber" />
        <StatCard label="Pending Approvals" value={data.pendingApprovals} icon={Clock3} accent="amber" />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200 p-4 dark:border-slate-800">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Recent Leave Requests</h3>
          <Link to="/leaves/approvals" className="text-xs text-indigo-600 hover:underline dark:text-indigo-400">
            View all
          </Link>
        </div>
        {data.recentLeaveRequests.length === 0 ? (
          <EmptyState title="No recent requests" message="Your team hasn't submitted any leave requests yet." />
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-slate-800 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium">Employee</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Dates</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {data.recentLeaveRequests.map((leave) => (
                <tr key={leave._id} className="text-slate-700 dark:text-slate-200">
                  <td className="px-4 py-3">{leave.employee?.firstName} {leave.employee?.lastName}</td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{leave.leaveType?.name}</td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                    {formatDate(leave.startDate)} – {formatDate(leave.endDate)}
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={leave.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
