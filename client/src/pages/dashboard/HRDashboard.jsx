import { useEffect, useState } from 'react';
import {
  Users, UserCheck, UserX, CalendarClock, Clock3, Wallet,
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, LineChart, Line,
} from 'recharts';
import { dashboardApi } from '../../api/dashboardApi';
import StatCard from '../../components/dashboard/StatCard';
import { Loading, ErrorState } from '../../components/StateViews';

const PIE_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#0ea5e9', '#a855f7'];

function currency(value) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value || 0);
}

export default function HRDashboard() {
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    dashboardApi
      .hr()
      .then(({ data }) => {
        setData(data.data);
        setStatus('ready');
      })
      .catch(() => setStatus('error'));
  }, []);

  if (status === 'loading') return <Loading label="Loading dashboard…" />;
  if (status === 'error' || !data) return <ErrorState message="Failed to load the dashboard." />;

  const { charts } = data;

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold text-slate-900 dark:text-white">HR Dashboard</h1>
      <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">An overview of your organization right now.</p>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Employees" value={data.totalEmployees} icon={Users} accent="indigo" />
        <StatCard label="Active Employees" value={data.activeEmployees} icon={UserCheck} accent="emerald" />
        <StatCard label="Present Today" value={data.presentToday} icon={UserCheck} accent="emerald" />
        <StatCard label="Absent Today" value={data.absentToday} icon={UserX} accent="red" />
        <StatCard label="On Leave Today" value={data.onLeaveToday} icon={CalendarClock} accent="amber" />
        <StatCard label="Pending Approvals" value={data.pendingApprovals} icon={Clock3} accent="amber" />
        <StatCard label="Monthly Payroll" value={currency(data.monthlyPayrollTotal)} icon={Wallet} accent="indigo" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Attendance Overview (Last 7 Days)">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={charts.attendanceOverview}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" fontSize={12} />
              <YAxis fontSize={12} allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="present" stackId="a" fill="#6366f1" name="Present" />
              <Bar dataKey="halfDay" stackId="a" fill="#f59e0b" name="Half Day" />
              <Bar dataKey="leave" stackId="a" fill="#0ea5e9" name="Leave" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Employees by Department">
          {charts.employeeDistribution.length === 0 ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={charts.employeeDistribution}
                  dataKey="count"
                  nameKey="department"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  label={(entry) => entry.department}
                >
                  {charts.employeeDistribution.map((entry, index) => (
                    <Cell key={entry.department} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Leave Status Breakdown">
          {charts.leaveStatusBreakdown.length === 0 ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={charts.leaveStatusBreakdown}
                  dataKey="count"
                  nameKey="status"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  label={(entry) => entry.status}
                >
                  {charts.leaveStatusBreakdown.map((entry, index) => (
                    <Cell key={entry.status} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Payroll Trend (Last 6 Months)">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={charts.payrollTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" fontSize={12} />
              <YAxis fontSize={12} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
              <Tooltip formatter={(value) => currency(value)} />
              <Line type="monotone" dataKey="total" stroke="#6366f1" strokeWidth={2} name="Net Payroll" />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}

function ChartCard({ title, children }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <h3 className="mb-2 text-sm font-semibold text-slate-900 dark:text-white">{title}</h3>
      {children}
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="flex h-[260px] items-center justify-center text-sm text-slate-400">
      Not enough data yet
    </div>
  );
}
