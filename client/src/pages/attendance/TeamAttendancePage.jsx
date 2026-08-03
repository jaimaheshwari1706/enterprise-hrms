import { useCallback, useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { useSelector } from 'react-redux';
import { employeeApi } from '../../api/employeeApi';
import { attendanceApi } from '../../api/attendanceApi';
import { exportApi } from '../../api/exportApi';
import { selectCurrentUser } from '../../features/auth/authSlice';
import Avatar from '../../components/Avatar';
import StatusBadge from '../../components/StatusBadge';
import Pagination from '../../components/Pagination';
import Button from '../../components/Button';
import { useToast } from '../../hooks/useToast';
import { EmptyState, ErrorState, Loading } from '../../components/StateViews';

function formatTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(value) {
  return new Date(value).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

const inputClass =
  'rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white';

export default function TeamAttendancePage() {
  const user = useSelector(selectCurrentUser);
  const canExport = user?.role === 'HR_ADMIN' || user?.role === 'SUPER_ADMIN';
  const { showToast } = useToast();

  const [employees, setEmployees] = useState([]);
  const [employeeFilter, setEmployeeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);

  const [records, setRecords] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [status, setStatus] = useState('loading');

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportApi.attendance({
        employee: employeeFilter || undefined,
        status: statusFilter || undefined,
        from: from || undefined,
        to: to || undefined,
      });
    } catch {
      showToast('Failed to export attendance', 'error');
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => {
    employeeApi.list({ limit: 200 }).then(({ data }) => setEmployees(data.data));
  }, []);

  const fetchRecords = useCallback(async () => {
    setStatus('loading');
    try {
      const { data } = await attendanceApi.list({
        page,
        limit: 10,
        employee: employeeFilter || undefined,
        status: statusFilter || undefined,
        from: from || undefined,
        to: to || undefined,
      });
      setRecords(data.data);
      setPagination(data.pagination);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, [page, employeeFilter, statusFilter, from, to]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  useEffect(() => {
    setPage(1);
  }, [employeeFilter, statusFilter, from, to]);

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold text-slate-900 dark:text-white">Team Attendance</h1>
      <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">
        View and filter attendance records for your team.
      </p>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-3">
          <select value={employeeFilter} onChange={(e) => setEmployeeFilter(e.target.value)} className={inputClass}>
            <option value="">All employees</option>
            {employees.map((e) => (
              <option key={e._id} value={e._id}>{e.firstName} {e.lastName} ({e.employeeId})</option>
            ))}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={inputClass}>
            <option value="">All statuses</option>
            <option value="Present">Present</option>
            <option value="HalfDay">Half Day</option>
            <option value="Absent">Absent</option>
            <option value="Leave">Leave</option>
          </select>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputClass} />
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputClass} />
        </div>
        {canExport && (
          <Button variant="secondary" onClick={handleExport} disabled={exporting}>
            <Download size={16} /> {exporting ? 'Exporting…' : 'Export'}
          </Button>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        {status === 'loading' && <Loading label="Loading attendance…" />}
        {status === 'error' && <ErrorState message="Failed to load attendance records." />}
        {status === 'ready' && records.length === 0 && (
          <EmptyState title="No attendance records found" message="Try adjusting the filters above." />
        )}
        {status === 'ready' && records.length > 0 && (
          <>
            <div className="overflow-x-auto"><table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-slate-800 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Employee</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Check In</th>
                  <th className="px-4 py-3 font-medium">Check Out</th>
                  <th className="px-4 py-3 font-medium">Hours</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {records.map((rec) => (
                  <tr key={rec._id} className="text-slate-700 dark:text-slate-200">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Avatar src={rec.employee?.profileImageUrl} name={`${rec.employee?.firstName} ${rec.employee?.lastName}`} size={28} />
                        <span>{rec.employee?.firstName} {rec.employee?.lastName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{formatDate(rec.date)}</td>
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
