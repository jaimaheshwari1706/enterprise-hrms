import { useCallback, useEffect, useState } from 'react';
import { Plus, Settings, Download } from 'lucide-react';
import { payrollApi } from '../../api/payrollApi';
import { employeeApi } from '../../api/employeeApi';
import { exportApi } from '../../api/exportApi';
import { useToast } from '../../components/ToastProvider';
import Button from '../../components/Button';
import Avatar from '../../components/Avatar';
import StatusBadge from '../../components/StatusBadge';
import Pagination from '../../components/Pagination';
import { EmptyState, ErrorState, Loading } from '../../components/StateViews';
import GeneratePayrollModal from './GeneratePayrollModal';
import SalaryConfigModal from './SalaryConfigModal';

function currency(value) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value || 0);
}

const inputClass =
  'rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white';

const STATUS_FLOW = { Draft: 'Processed', Processed: 'Paid' };

export default function PayrollManagementPage() {
  const { showToast } = useToast();
  const [tab, setTab] = useState('records'); // records | salaries

  const [employees, setEmployees] = useState([]);
  useEffect(() => {
    employeeApi.list({ limit: 200, status: 'active' }).then(({ data }) => setEmployees(data.data));
  }, []);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white">Payroll Management</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Generate payroll and configure employee salaries.</p>
        </div>
      </div>

      <div className="mb-4 flex gap-1 border-b border-slate-200 dark:border-slate-800">
        {['records', 'salaries'].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`border-b-2 px-3 py-2 text-sm font-medium capitalize transition-colors ${
              tab === t
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            {t === 'records' ? 'Payroll Records' : 'Salary Configuration'}
          </button>
        ))}
      </div>

      {tab === 'records' && <PayrollRecordsTab employees={employees} showToast={showToast} />}
      {tab === 'salaries' && <SalaryConfigTab employees={employees} showToast={showToast} />}
    </div>
  );
}

function PayrollRecordsTab({ employees, showToast }) {
  const [monthFilter, setMonthFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [employeeFilter, setEmployeeFilter] = useState('');
  const [page, setPage] = useState(1);

  const [records, setRecords] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [status, setStatus] = useState('loading');

  const [generateOpen, setGenerateOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportApi.payroll({
        month: monthFilter || undefined,
        status: statusFilter || undefined,
        employee: employeeFilter || undefined,
      });
    } catch {
      showToast('Failed to export payroll', 'error');
    } finally {
      setExporting(false);
    }
  };

  const fetchRecords = useCallback(async () => {
    setStatus('loading');
    try {
      const { data } = await payrollApi.list({
        page,
        limit: 10,
        month: monthFilter || undefined,
        status: statusFilter || undefined,
        employee: employeeFilter || undefined,
      });
      setRecords(data.data);
      setPagination(data.pagination);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, [page, monthFilter, statusFilter, employeeFilter]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  useEffect(() => {
    setPage(1);
  }, [monthFilter, statusFilter, employeeFilter]);

  const handleGenerate = async (payload) => {
    setGenerating(true);
    try {
      const { data } = await payrollApi.generate(payload);
      showToast(data.message);
      setGenerateOpen(false);
      fetchRecords();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to generate payroll', 'error');
    } finally {
      setGenerating(false);
    }
  };

  const advanceStatus = async (record) => {
    const nextStatus = STATUS_FLOW[record.status];
    if (!nextStatus) return;
    try {
      await payrollApi.updateStatus(record._id, nextStatus);
      showToast(`Marked as ${nextStatus}`);
      fetchRecords();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to update status', 'error');
    }
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-3">
          <input type="month" value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)} className={inputClass} />
          <select value={employeeFilter} onChange={(e) => setEmployeeFilter(e.target.value)} className={inputClass}>
            <option value="">All employees</option>
            {employees.map((e) => (
              <option key={e._id} value={e._id}>{e.firstName} {e.lastName}</option>
            ))}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={inputClass}>
            <option value="">All statuses</option>
            <option value="Draft">Draft</option>
            <option value="Processed">Processed</option>
            <option value="Paid">Paid</option>
          </select>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={handleExport} disabled={exporting}>
            <Download size={16} /> {exporting ? 'Exporting…' : 'Export'}
          </Button>
          <Button onClick={() => setGenerateOpen(true)}>
            <Plus size={16} /> Generate Payroll
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        {status === 'loading' && <Loading label="Loading payroll records…" />}
        {status === 'error' && <ErrorState message="Failed to load payroll records." />}
        {status === 'ready' && records.length === 0 && (
          <EmptyState title="No payroll records found" message="Generate payroll for a month to get started." />
        )}
        {status === 'ready' && records.length > 0 && (
          <>
            <div className="overflow-x-auto"><table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-slate-800 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Employee</th>
                  <th className="px-4 py-3 font-medium">Month</th>
                  <th className="px-4 py-3 font-medium">Net Salary</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
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
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{rec.month}</td>
                    <td className="px-4 py-3 font-medium">{currency(rec.netSalary)}</td>
                    <td className="px-4 py-3"><StatusBadge status={rec.status} /></td>
                    <td className="px-4 py-3">
                      {STATUS_FLOW[rec.status] && (
                        <Button variant="secondary" onClick={() => advanceStatus(rec)} className="!px-2 !py-1 text-xs">
                          Mark {STATUS_FLOW[rec.status]}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table></div>
            <Pagination pagination={pagination} onPageChange={setPage} />
          </>
        )}
      </div>

      <GeneratePayrollModal
        open={generateOpen}
        onClose={() => setGenerateOpen(false)}
        onSubmit={handleGenerate}
        employees={employees}
        submitting={generating}
      />
    </div>
  );
}

function SalaryConfigTab({ employees, showToast }) {
  const [modalTarget, setModalTarget] = useState(null); // employee
  const [currentSalary, setCurrentSalary] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const openModal = async (employee) => {
    try {
      const { data } = await payrollApi.getSalary(employee._id);
      setCurrentSalary(data.data);
      setModalTarget(employee);
    } catch {
      showToast('Failed to load current salary', 'error');
    }
  };

  const handleSubmit = async (values) => {
    setSubmitting(true);
    try {
      await payrollApi.updateSalary(modalTarget._id, values);
      showToast('Salary updated successfully');
      setModalTarget(null);
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to update salary', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      {employees.length === 0 ? (
        <EmptyState title="No active employees" message="Add employees first to configure their salaries." />
      ) : (
        <div className="overflow-x-auto"><table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3 font-medium">Employee</th>
              <th className="px-4 py-3 font-medium">Employee ID</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {employees.map((emp) => (
              <tr key={emp._id} className="text-slate-700 dark:text-slate-200">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Avatar src={emp.profileImageUrl} name={`${emp.firstName} ${emp.lastName}`} size={28} />
                    <span>{emp.firstName} {emp.lastName}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{emp.employeeId}</td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => openModal(emp)}
                    className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                    title="Configure salary"
                  >
                    <Settings size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
      )}

      <SalaryConfigModal
        open={Boolean(modalTarget)}
        onClose={() => setModalTarget(null)}
        onSubmit={handleSubmit}
        salary={currentSalary}
        employeeName={modalTarget ? `${modalTarget.firstName} ${modalTarget.lastName}` : ''}
        submitting={submitting}
      />
    </div>
  );
}
