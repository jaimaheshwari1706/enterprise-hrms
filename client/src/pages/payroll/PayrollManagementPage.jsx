import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Settings2, Download, Wallet, ArrowRight, AlertCircle, ListChecks, BadgeIndianRupee, FileText } from 'lucide-react';
import { payrollApi } from '../../api/payrollApi';
import { employeeApi } from '../../api/employeeApi';
import { exportApi } from '../../api/exportApi';
import { useToast } from '../../hooks/useToast';
import { useApiQuery } from '../../hooks/useApiQuery';
import { useListParams } from '../../hooks/useListParams';
import {
  Button, IconButton, Card, PageHeader, DataTable, StatusBadge, Avatar, Input, Select, Toolbar, Tabs, ConfirmDialog, Badge, NoResults, Alert,
} from '../../components/ui';
import { formatCurrency, formatMonth, fullName } from '../../utils/format';
import { getApiErrorMessage } from '../../utils/apiError';
import GeneratePayrollModal from './GeneratePayrollModal';
import SalaryConfigModal from './SalaryConfigModal';

const STATUS_FLOW = { Draft: 'Processed', Processed: 'Paid' };

export default function PayrollManagementPage() {
  const [tab, setTab] = useState('records');
  const employees = useApiQuery((signal) => employeeApi.options({ signal }), []);

  return (
    <div>
      <PageHeader title="Payroll Management" description="Generate monthly payroll and maintain salary structures." />
      <Tabs
        tabs={[
          { value: 'records', label: 'Payroll records', icon: ListChecks },
          { value: 'salaries', label: 'Salary structures', icon: BadgeIndianRupee },
        ]}
        value={tab}
        onChange={setTab}
        className="mb-5"
      />
      {tab === 'records' ? <PayrollRecordsTab employees={employees.data || []} /> : <SalaryConfigTab />}
    </div>
  );
}

function PayrollRecordsTab({ employees }) {
  const { showToast } = useToast();
  const list = useListParams({ pageSize: 10, sort: '-month', filters: { month: '', status: '', employee: '' } });
  const records = useApiQuery((signal) => payrollApi.list(list.params, { signal }), [JSON.stringify(list.params)]);

  const [generateOpen, setGenerateOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState(null);
  const [generateResult, setGenerateResult] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [advanceTarget, setAdvanceTarget] = useState(null);
  const [advancing, setAdvancing] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportApi.payroll({
        month: list.filters.month || undefined,
        status: list.filters.status || undefined,
        employee: list.filters.employee || undefined,
      });
      showToast('Payroll export downloaded');
    } catch (err) {
      showToast(getApiErrorMessage(err, 'Unable to export payroll.'), 'error');
    } finally {
      setExporting(false);
    }
  };

  const handleGenerate = async (payload) => {
    setGenerating(true);
    setGenerateError(null);
    try {
      const { data } = await payrollApi.generate(payload);
      setGenerateOpen(false);
      setGenerateResult({ month: payload.month, ...data.data });
      showToast(data.message);
      records.refetch();
    } catch (err) {
      setGenerateError(getApiErrorMessage(err, 'Unable to generate payroll.'));
    } finally {
      setGenerating(false);
    }
  };

  const advanceStatus = async () => {
    const nextStatus = STATUS_FLOW[advanceTarget.status];
    setAdvancing(true);
    try {
      await payrollApi.updateStatus(advanceTarget._id, nextStatus);
      showToast(`Marked as ${nextStatus}`);
      setAdvanceTarget(null);
      records.refetch();
    } catch (err) {
      showToast(getApiErrorMessage(err, 'Unable to update status.'), 'error');
    } finally {
      setAdvancing(false);
    }
  };

  const columns = [
    {
      key: 'employee',
      header: 'Employee',
      primary: true,
      render: (rec) => (
        <Link to={`/employees/${rec.employee?._id}`} className="flex items-center gap-3 hover:underline">
          <Avatar src={rec.employee?.profileImageUrl} name={fullName(rec.employee)} size={30} />
          <div className="min-w-0">
            <p className="truncate font-medium text-slate-900 dark:text-white">{fullName(rec.employee) || 'Unknown'}</p>
            <p className="truncate font-mono text-xs text-slate-500 dark:text-slate-400">{rec.employee?.employeeId}</p>
          </div>
        </Link>
      ),
    },
    { key: 'month', header: 'Month', sortKey: 'month', defaultDesc: true, render: (rec) => formatMonth(rec.month), className: 'text-slate-600 dark:text-slate-300' },
    { key: 'grossSalary', header: 'Gross', sortKey: 'grossSalary', align: 'right', render: (rec) => formatCurrency(rec.grossSalary), className: 'text-slate-600 dark:text-slate-300', hideOnMobile: true },
    { key: 'deductions', header: 'Deductions', align: 'right', render: (rec) => formatCurrency(rec.deductions), className: 'text-slate-600 dark:text-slate-300', hideOnMobile: true },
    { key: 'netSalary', header: 'Net', sortKey: 'netSalary', align: 'right', render: (rec) => <span className="font-semibold text-slate-900 dark:text-white">{formatCurrency(rec.netSalary)}</span> },
    { key: 'status', header: 'Status', sortKey: 'status', render: (rec) => <StatusBadge status={rec.status} /> },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      isActions: true,
      align: 'right',
      width: 190,
      render: (rec) => (
        <div className="flex items-center justify-end gap-1">
          <IconButton as={Link} to={`/payroll/${rec._id}`} label={`View payslip for ${fullName(rec.employee)} (${formatMonth(rec.month)})`} icon={FileText} />
          {STATUS_FLOW[rec.status] ? (
            <Button variant="secondary" size="xs" iconRight={ArrowRight} onClick={() => setAdvanceTarget(rec)}>
              Mark {STATUS_FLOW[rec.status]}
            </Button>
          ) : (
            <span className="px-2 text-xs text-slate-400">Final</span>
          )}
        </div>
      ),
    },
  ];

  const totals = records.meta?.totals;

  return (
    <div>
      {generateResult && (
        <Alert tone={generateResult.generated.length ? 'success' : 'warning'} className="mb-4" title={`Payroll run for ${formatMonth(generateResult.month)}: ${generateResult.generated.length} created, ${generateResult.skipped.length} skipped`}>
          {generateResult.skipped.length > 0 && (
            <ul className="mt-1 list-inside list-disc">
              {generateResult.skipped.slice(0, 5).map((s) => (
                <li key={s.employee}>
                  {s.employee} — {s.reason}
                </li>
              ))}
              {generateResult.skipped.length > 5 && <li>…and {generateResult.skipped.length - 5} more</li>}
            </ul>
          )}
          <button type="button" onClick={() => setGenerateResult(null)} className="mt-2 text-xs font-medium underline">
            Dismiss
          </button>
        </Alert>
      )}

      <Toolbar
        actions={
          <>
            <Button variant="secondary" icon={Download} onClick={handleExport} loading={exporting}>
              Export
            </Button>
            <Button icon={Plus} onClick={() => { setGenerateError(null); setGenerateOpen(true); }}>
              Generate payroll
            </Button>
          </>
        }
      >
        <Input type="month" value={list.filters.month} onChange={(e) => list.setFilter('month', e.target.value)} aria-label="Filter by month" className="w-full sm:w-44" />
        <Select value={list.filters.employee} onChange={(e) => list.setFilter('employee', e.target.value)} aria-label="Filter by employee" className="w-full sm:w-56">
          <option value="">All employees</option>
          {employees.map((e) => (
            <option key={e._id} value={e._id}>
              {fullName(e)} ({e.employeeId})
            </option>
          ))}
        </Select>
        <Select value={list.filters.status} onChange={(e) => list.setFilter('status', e.target.value)} aria-label="Filter by status" className="w-full sm:w-40">
          <option value="">All statuses</option>
          <option value="Draft">Draft</option>
          <option value="Processed">Processed</option>
          <option value="Paid">Paid</option>
        </Select>
        {list.hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={list.resetFilters}>
            Clear
          </Button>
        )}
      </Toolbar>

      {totals && records.pagination?.total > 0 && (
        <div className="mb-4 flex flex-wrap gap-2 text-xs">
          <Badge tone="neutral">{records.pagination.total} payslip{records.pagination.total === 1 ? '' : 's'}</Badge>
          <Badge tone="neutral">Gross {formatCurrency(totals.gross)}</Badge>
          <Badge tone="neutral">Deductions {formatCurrency(totals.deductions)}</Badge>
          <Badge tone="primary">Net {formatCurrency(totals.net)}</Badge>
        </div>
      )}

      <Card>
        {records.status === 'ready' && records.data?.length === 0 && list.hasActiveFilters ? (
          <NoResults onClear={list.resetFilters} />
        ) : (
          <DataTable
            caption="Payroll records"
            columns={columns}
            rows={records.data || []}
            status={records.status}
            isFetching={records.isFetching}
            error={records.error}
            onRetry={records.refetch}
            sort={list.sort}
            onSort={list.setSort}
            pagination={records.pagination}
            onPageChange={list.setPage}
            onPageSizeChange={list.setPageSize}
            emptyIcon={Wallet}
            emptyTitle="No payroll generated yet"
            emptyMessage="Configure salary structures, then generate payroll for a month."
            emptyAction={<Button icon={Plus} onClick={() => setGenerateOpen(true)}>Generate payroll</Button>}
          />
        )}
      </Card>

      <GeneratePayrollModal open={generateOpen} onClose={() => setGenerateOpen(false)} onSubmit={handleGenerate} employees={employees} submitting={generating} serverError={generateError} />

      <ConfirmDialog
        open={Boolean(advanceTarget)}
        onClose={() => setAdvanceTarget(null)}
        onConfirm={advanceStatus}
        tone="info"
        title={`Mark payroll as ${STATUS_FLOW[advanceTarget?.status] || ''}`}
        message={
          advanceTarget
            ? `${fullName(advanceTarget.employee)} · ${formatMonth(advanceTarget.month)} · ${formatCurrency(advanceTarget.netSalary)} net. ${
                STATUS_FLOW[advanceTarget.status] === 'Paid' ? 'Paid is final and cannot be reverted.' : 'Processed payslips become visible to the employee.'
              }`
            : ''
        }
        confirmLabel={`Mark ${STATUS_FLOW[advanceTarget?.status] || ''}`}
        loading={advancing}
      />
    </div>
  );
}

function SalaryConfigTab() {
  const { showToast } = useToast();
  const salaries = useApiQuery((signal) => payrollApi.listSalaries({ signal }), []);
  const [modalTarget, setModalTarget] = useState(null); // { employee, salary }
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const [search, setSearch] = useState('');
  const [onlyMissing, setOnlyMissing] = useState(false);

  const handleSubmit = async (values) => {
    setSubmitting(true);
    setFormError(null);
    try {
      await payrollApi.updateSalary(modalTarget.employee._id, values);
      showToast(`Salary updated for ${fullName(modalTarget.employee)}`);
      setModalTarget(null);
      salaries.refetch();
    } catch (err) {
      setFormError(getApiErrorMessage(err, 'Unable to update salary.'));
    } finally {
      setSubmitting(false);
    }
  };

  const rows = (salaries.data || []).filter((row) => {
    if (onlyMissing && row.salary) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return fullName(row.employee).toLowerCase().includes(q) || row.employee.employeeId.toLowerCase().includes(q);
  });
  const missing = (salaries.data || []).filter((r) => !r.salary).length;

  const columns = [
    {
      key: 'employee',
      header: 'Employee',
      primary: true,
      render: (row) => (
        <div className="flex items-center gap-3">
          <Avatar src={row.employee.profileImageUrl} name={fullName(row.employee)} size={30} />
          <div className="min-w-0">
            <p className="truncate font-medium text-slate-900 dark:text-white">{fullName(row.employee)}</p>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">
              <span className="font-mono">{row.employee.employeeId}</span> · {row.employee.designation?.name || '—'}
            </p>
          </div>
        </div>
      ),
    },
    { key: 'department', header: 'Department', render: (row) => row.employee.department?.name || '—', className: 'text-slate-600 dark:text-slate-300', hideOnMobile: true },
    { key: 'basic', header: 'Basic', align: 'right', render: (row) => (row.salary ? formatCurrency(row.salary.basic) : '—'), className: 'text-slate-600 dark:text-slate-300', hideOnMobile: true },
    { key: 'gross', header: 'Gross', align: 'right', render: (row) => (row.salary ? formatCurrency(row.grossSalary) : '—'), className: 'text-slate-600 dark:text-slate-300' },
    {
      key: 'net',
      header: 'Net',
      align: 'right',
      render: (row) =>
        row.salary ? <span className="font-semibold text-slate-900 dark:text-white">{formatCurrency(row.netSalary)}</span> : <StatusBadge tone="warning" label="Not configured" />,
    },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      isActions: true,
      align: 'right',
      width: 64,
      render: (row) => <IconButton label={`Configure salary for ${fullName(row.employee)}`} icon={Settings2} onClick={() => { setFormError(null); setModalTarget(row); }} />,
    },
  ];

  return (
    <div>
      {missing > 0 && salaries.status === 'ready' && (
        <Alert tone="warning" className="mb-4" title={`${missing} active employee${missing === 1 ? '' : 's'} without a salary structure`}>
          They will be skipped when payroll is generated.{' '}
          <button type="button" className="font-medium underline" onClick={() => setOnlyMissing(true)}>
            Show them
          </button>
        </Alert>
      )}
      <Toolbar>
        <Input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or ID…" aria-label="Search employees" className="w-full sm:w-72" />
        <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          <input type="checkbox" checked={onlyMissing} onChange={(e) => setOnlyMissing(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500" />
          Only missing structures
        </label>
      </Toolbar>
      <Card>
        {salaries.status === 'ready' && rows.length === 0 && (search || onlyMissing) ? (
          <NoResults onClear={() => { setSearch(''); setOnlyMissing(false); }} />
        ) : (
          <DataTable
            caption="Salary structures"
            columns={columns}
            rows={rows}
            status={salaries.status}
            isFetching={salaries.isFetching}
            error={salaries.error}
            onRetry={salaries.refetch}
            emptyIcon={AlertCircle}
            emptyTitle="No active employees"
            emptyMessage="Add employees first to configure their salaries."
          />
        )}
      </Card>

      <SalaryConfigModal
        open={Boolean(modalTarget)}
        onClose={() => setModalTarget(null)}
        onSubmit={handleSubmit}
        salary={modalTarget?.salary}
        employeeName={modalTarget ? fullName(modalTarget.employee) : ''}
        submitting={submitting}
        serverError={formError}
      />
    </div>
  );
}
