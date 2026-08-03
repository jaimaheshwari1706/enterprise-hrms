import { useCallback, useEffect, useState } from 'react';
import { LogIn, LogOut, Clock } from 'lucide-react';
import { attendanceApi } from '../../api/attendanceApi';
import { useToast } from '../../hooks/useToast';
import Button from '../../components/Button';
import Pagination from '../../components/Pagination';
import StatusBadge from '../../components/StatusBadge';
import { EmptyState, ErrorState, Loading } from '../../components/StateViews';

function formatTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(value) {
  return new Date(value).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function AttendancePage() {
  const { showToast } = useToast();

  const [today, setToday] = useState(null);
  const [todayStatus, setTodayStatus] = useState('loading');
  const [actionLoading, setActionLoading] = useState(false);

  const [history, setHistory] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [historyStatus, setHistoryStatus] = useState('loading');

  const fetchToday = useCallback(async () => {
    setTodayStatus('loading');
    try {
      const { data } = await attendanceApi.today();
      setToday(data.data);
      setTodayStatus('ready');
    } catch {
      setTodayStatus('error');
    }
  }, []);

  const fetchHistory = useCallback(async () => {
    setHistoryStatus('loading');
    try {
      const { data } = await attendanceApi.myHistory({ page, limit: 10 });
      setHistory(data.data);
      setPagination(data.pagination);
      setHistoryStatus('ready');
    } catch {
      setHistoryStatus('error');
    }
  }, [page]);

  useEffect(() => {
    fetchToday();
  }, [fetchToday]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleCheckIn = async () => {
    setActionLoading(true);
    try {
      await attendanceApi.checkIn();
      showToast('Checked in successfully');
      fetchToday();
      fetchHistory();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to check in', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCheckOut = async () => {
    setActionLoading(true);
    try {
      await attendanceApi.checkOut();
      showToast('Checked out successfully');
      fetchToday();
      fetchHistory();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to check out', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const hasCheckedIn = Boolean(today?.checkIn);
  const hasCheckedOut = Boolean(today?.checkOut);

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold text-slate-900 dark:text-white">Attendance</h1>
      <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">
        Track your daily check-in and check-out.
      </p>

      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        {todayStatus === 'loading' && <Loading label="Loading today's status…" />}
        {todayStatus === 'error' && <ErrorState message="Failed to load today's attendance." />}
        {todayStatus === 'ready' && (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
                <Clock size={22} />
              </div>
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Today, {formatDate(new Date())}</p>
                <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                  {hasCheckedIn ? `Checked in at ${formatTime(today.checkIn)}` : 'Not checked in yet'}
                  {hasCheckedOut && ` · Checked out at ${formatTime(today.checkOut)}`}
                </p>
                {hasCheckedOut && (
                  <p className="text-xs text-slate-400">
                    {today.workingHours} hours worked · <StatusBadge status={today.status} />
                  </p>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleCheckIn} disabled={hasCheckedIn || actionLoading}>
                <LogIn size={16} /> Check In
              </Button>
              <Button variant="secondary" onClick={handleCheckOut} disabled={!hasCheckedIn || hasCheckedOut || actionLoading}>
                <LogOut size={16} /> Check Out
              </Button>
            </div>
          </div>
        )}
      </div>

      <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">Recent History</h2>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        {historyStatus === 'loading' && <Loading label="Loading history…" />}
        {historyStatus === 'error' && <ErrorState message="Failed to load attendance history." />}
        {historyStatus === 'ready' && history.length === 0 && (
          <EmptyState title="No attendance records yet" message="Check in for the first time to start building your history." />
        )}
        {historyStatus === 'ready' && history.length > 0 && (
          <>
            <div className="overflow-x-auto"><table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-slate-800 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Check In</th>
                  <th className="px-4 py-3 font-medium">Check Out</th>
                  <th className="px-4 py-3 font-medium">Hours</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {history.map((rec) => (
                  <tr key={rec._id} className="text-slate-700 dark:text-slate-200">
                    <td className="px-4 py-3">{formatDate(rec.date)}</td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{formatTime(rec.checkIn)}</td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{formatTime(rec.checkOut)}</td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{rec.workingHours || '—'}</td>
                    <td className="px-4 py-3"><StatusBadge status={rec.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table></div>
            <Pagination pagination={pagination} onPageChange={setPage} />
          </>
        )}
      </div>
    </div>
  );
}
