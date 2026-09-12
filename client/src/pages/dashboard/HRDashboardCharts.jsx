import { useSelector } from 'react-redux';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LineChart, Line, LabelList,
} from 'recharts';
import { Card, CardHeader, EmptyState } from '../../components/ui';
import { formatCompactCurrency, formatCurrency, formatMonth } from '../../utils/format';
import { seriesColors, chartChrome, tooltipStyle } from './chartTheme';

// Every chart on the HR dashboard lives here so recharts (the largest
// dependency) loads as its own chunk *after* the KPI tiles have painted.
export default function HRDashboardCharts({ charts }) {
  const mode = useSelector((state) => state.theme.mode);
  const colors = seriesColors(mode);
  const chrome = chartChrome(mode);
  const tip = tooltipStyle(mode);

  const axisProps = { tick: { fill: chrome.tick, fontSize: 11 }, axisLine: { stroke: chrome.axis }, tickLine: false };
  const hasAttendance = charts.attendanceOverview.some((d) => d.present + d.halfDay + d.leave > 0);
  const hasPayroll = charts.payrollTrend.some((d) => d.total > 0);
  const hasJoining = charts.joiningTrend.some((d) => d.count > 0);
  const departmentData = [...charts.employeeDistribution].sort((a, b) => b.count - a.count).slice(0, 10);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader title="Attendance — last 7 days" description="Present, half day and on leave, per day" />
        <div className="p-4 pt-2">
          {hasAttendance ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={charts.attendanceOverview} barCategoryGap="30%">
                <CartesianGrid vertical={false} stroke={chrome.grid} />
                <XAxis dataKey="date" {...axisProps} />
                <YAxis allowDecimals={false} width={32} {...axisProps} axisLine={false} />
                <Tooltip {...tip} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                <Bar dataKey="present" stackId="a" fill={colors.present} name="Present" stroke={chrome.tooltipBg} strokeWidth={1} />
                <Bar dataKey="halfDay" stackId="a" fill={colors.halfDay} name="Half day" stroke={chrome.tooltipBg} strokeWidth={1} />
                <Bar dataKey="leave" stackId="a" fill={colors.leave} name="On leave" radius={[4, 4, 0, 0]} stroke={chrome.tooltipBg} strokeWidth={1} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState compact title="No attendance yet" message="Check-ins from the last 7 days will appear here." />
          )}
        </div>
      </Card>

      <Card>
        <CardHeader title="Employees by department" description="Active headcount, largest first" />
        <div className="p-4 pt-2">
          {departmentData.length === 0 ? (
            <EmptyState compact title="No departments yet" message="Assign employees to departments to see the split." />
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(200, departmentData.length * 34 + 30)}>
              <BarChart data={departmentData} layout="vertical" margin={{ left: 8, right: 36 }} barCategoryGap="28%">
                <CartesianGrid horizontal={false} stroke={chrome.grid} />
                <XAxis type="number" allowDecimals={false} hide />
                <YAxis type="category" dataKey="department" width={120} {...axisProps} axisLine={false} tick={{ fill: chrome.tick, fontSize: 12 }} />
                <Tooltip {...tip} formatter={(value) => [value, 'Employees']} />
                <Bar dataKey="count" fill={colors.primary} radius={[0, 4, 4, 0]} name="Employees" maxBarSize={22}>
                  <LabelList dataKey="count" position="right" style={{ fill: chrome.tick, fontSize: 11 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader title="Payroll trend — last 6 months" description="Total net payroll per month" />
        <div className="p-4 pt-2">
          {hasPayroll ? (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={charts.payrollTrend} margin={{ left: 4, right: 12 }}>
                <CartesianGrid vertical={false} stroke={chrome.grid} />
                <XAxis dataKey="month" tickFormatter={(m) => formatMonth(m).replace(/ \d{4}$/, '')} {...axisProps} />
                <YAxis tickFormatter={formatCompactCurrency} width={44} {...axisProps} axisLine={false} />
                <Tooltip {...tip} labelFormatter={formatMonth} formatter={(value, name, entry) => [`${formatCurrency(value)} · ${entry.payload.count} payslips`, 'Net payroll']} />
                <Line type="monotone" dataKey="total" stroke={colors.primary} strokeWidth={2} dot={{ r: 3, strokeWidth: 2, fill: chrome.tooltipBg }} activeDot={{ r: 5 }} name="Net payroll" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState compact title="No payroll generated yet" message="Generate payroll for a month to start the trend." />
          )}
        </div>
      </Card>

      <Card>
        <CardHeader title="New joiners — last 6 months" description="Employees by joining month" />
        <div className="p-4 pt-2">
          {hasJoining ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={charts.joiningTrend} barCategoryGap="35%">
                <CartesianGrid vertical={false} stroke={chrome.grid} />
                <XAxis dataKey="month" tickFormatter={(m) => formatMonth(m).replace(/ \d{4}$/, '')} {...axisProps} />
                <YAxis allowDecimals={false} width={32} {...axisProps} axisLine={false} />
                <Tooltip {...tip} labelFormatter={formatMonth} formatter={(value) => [value, 'Joined']} />
                <Bar dataKey="count" fill={colors.accent} radius={[4, 4, 0, 0]} name="Joined" maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState compact title="No recent joiners" message="Employees who joined in the last 6 months will appear here." />
          )}
        </div>
      </Card>
    </div>
  );
}
