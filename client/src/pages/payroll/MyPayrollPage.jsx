import { useCallback, useEffect, useState } from 'react';
import { payrollApi } from '../../api/payrollApi';
import { useSelector } from 'react-redux';
import { selectCurrentUser } from '../../features/auth/authSlice';
import Pagination from '../../components/Pagination';
import StatusBadge from '../../components/StatusBadge';
import { EmptyState, ErrorState, Loading } from '../../components/StateViews';

function currency(value) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value || 0);
}

export default function MyPayrollPage() {
  const user = useSelector(selectCurrentUser);
  const [records, setRecords] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('loading');

  const fetchPayroll = useCallback(async () => {
    setStatus('loading');
    try {
      const { data } = await payrollApi.myPayroll({ page, limit: 12 });
      setRecords(data.data);
      setPagination(data.pagination);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, [page]);

  useEffect(() => {
    fetchPayroll();
  }, [fetchPayroll]);

  const latest = records[0];

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold text-slate-900 dark:text-white">My Payroll</h1>
      <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">View your salary breakdown and payslip history.</p>

      {!user?.employee && (
        <EmptyState title="No employee profile linked" message="This account isn't linked to an employee record." />
      )}

      {user?.employee && (
        <>
          {latest && (
            <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <SummaryCard label="Latest Month" value={latest.month} />
              <SummaryCard label="Gross Salary" value={currency(latest.grossSalary)} />
              <SummaryCard label="Deductions" value={currency(latest.deductions)} />
              <SummaryCard label="Net Salary" value={currency(latest.netSalary)} highlight />
            </div>
          )}

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            {status === 'loading' && <Loading label="Loading payroll…" />}
            {status === 'error' && <ErrorState message="Failed to load payroll records." />}
            {status === 'ready' && records.length === 0 && (
              <EmptyState title="No payroll records yet" message="Your payslips will appear here once HR processes them." />
            )}
            {status === 'ready' && records.length > 0 && (
              <>
                <div className="overflow-x-auto"><table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-slate-800 dark:text-slate-400">
                    <tr>
                      <th className="px-4 py-3 font-medium">Month</th>
                      <th className="px-4 py-3 font-medium">Basic</th>
                      <th className="px-4 py-3 font-medium">HRA</th>
                      <th className="px-4 py-3 font-medium">Allowances</th>
                      <th className="px-4 py-3 font-medium">Deductions</th>
                      <th className="px-4 py-3 font-medium">Net Salary</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {records.map((rec) => (
                      <tr key={rec._id} className="text-slate-700 dark:text-slate-200">
                        <td className="px-4 py-3 font-medium">{rec.month}</td>
                        <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{currency(rec.basic)}</td>
                        <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{currency(rec.hra)}</td>
                        <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{currency(rec.allowances)}</td>
                        <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{currency(rec.deductions)}</td>
                        <td className="px-4 py-3 font-medium">{currency(rec.netSalary)}</td>
                        <td className="px-4 py-3"><StatusBadge status={rec.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table></div>
                <Pagination pagination={pagination} onPageChange={setPage} />
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function SummaryCard({ label, value, highlight }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`mt-1 text-xl font-semibold ${highlight ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-900 dark:text-white'}`}>
        {value}
      </p>
    </div>
  );
}
