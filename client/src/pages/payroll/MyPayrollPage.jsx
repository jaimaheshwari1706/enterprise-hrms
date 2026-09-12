import { useSelector } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import { Wallet, FileText } from 'lucide-react';
import { payrollApi } from '../../api/payrollApi';
import { selectCurrentUser } from '../../features/auth/authSlice';
import { useApiQuery } from '../../hooks/useApiQuery';
import { useListParams } from '../../hooks/useListParams';
import { Card, PageHeader, DataTable, StatusBadge, StatCard, Alert, StatCardSkeleton, IconButton } from '../../components/ui';
import { formatCurrency, formatMonth } from '../../utils/format';

export default function MyPayrollPage() {
  const user = useSelector(selectCurrentUser);
  const navigate = useNavigate();
  const hasProfile = Boolean(user?.employee);
  const list = useListParams({ pageSize: 12, sort: '-month' });
  const payroll = useApiQuery((signal) => payrollApi.myPayroll(list.params, { signal }), [JSON.stringify(list.params)], { enabled: hasProfile });

  // The most recent payslip overall (not just on this page) is the first
  // row of the default sort on page 1.
  const latest = list.page === 1 && list.sort === '-month' ? payroll.data?.[0] : null;

  const columns = [
    { key: 'month', header: 'Month', sortKey: 'month', defaultDesc: true, primary: true, render: (rec) => <span className="font-medium text-slate-900 dark:text-white">{formatMonth(rec.month)}</span> },
    { key: 'basic', header: 'Basic', align: 'right', render: (rec) => formatCurrency(rec.basic), className: 'text-slate-600 dark:text-slate-300', hideOnMobile: true },
    { key: 'hra', header: 'HRA', align: 'right', render: (rec) => formatCurrency(rec.hra), className: 'text-slate-600 dark:text-slate-300', hideOnMobile: true },
    { key: 'allowances', header: 'Allowances', align: 'right', render: (rec) => formatCurrency(rec.allowances), className: 'text-slate-600 dark:text-slate-300', hideOnMobile: true },
    { key: 'grossSalary', header: 'Gross', align: 'right', render: (rec) => formatCurrency(rec.grossSalary), className: 'text-slate-600 dark:text-slate-300' },
    { key: 'deductions', header: 'Deductions', align: 'right', render: (rec) => formatCurrency(rec.deductions), className: 'text-slate-600 dark:text-slate-300' },
    { key: 'netSalary', header: 'Net', sortKey: 'netSalary', align: 'right', render: (rec) => <span className="font-semibold text-slate-900 dark:text-white">{formatCurrency(rec.netSalary)}</span> },
    { key: 'status', header: 'Status', render: (rec) => <StatusBadge status={rec.status} /> },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      isActions: true,
      align: 'right',
      width: 56,
      render: (rec) => <IconButton as={Link} to={`/payroll/${rec._id}`} label={`View payslip for ${formatMonth(rec.month)}`} icon={FileText} onClick={(e) => e.stopPropagation()} />,
    },
  ];

  if (!hasProfile) {
    return (
      <div>
        <PageHeader title="My Payroll" description="Your salary breakdown and payslip history." />
        <Alert tone="info" title="No employee profile linked">
          Payslips are issued against an employee record. Ask HR to link one to this account.
        </Alert>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="My Payroll" description="Your salary breakdown and payslip history." />

      {payroll.status === 'loading' ? (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <StatCardSkeleton key={i} />
          ))}
        </div>
      ) : latest ? (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <StatCard label="Latest payslip" value={formatMonth(latest.month)} icon={Wallet} accent="primary" hint={latest.status} />
          <StatCard label="Gross salary" value={formatCurrency(latest.grossSalary)} accent="slate" hint="Basic + HRA + allowances" />
          <StatCard label="Deductions" value={formatCurrency(latest.deductions)} accent="amber" />
          <StatCard label="Net salary" value={formatCurrency(latest.netSalary)} accent="emerald" valueClassName="text-emerald-700 dark:text-emerald-300" />
        </div>
      ) : null}

      <Card>
        <DataTable
          caption="My payslips"
          columns={columns}
          rows={payroll.data || []}
          status={payroll.status}
          isFetching={payroll.isFetching}
          error={payroll.error}
          onRetry={payroll.refetch}
          sort={list.sort}
          onSort={list.setSort}
          pagination={payroll.pagination}
          onPageChange={list.setPage}
          onPageSizeChange={list.setPageSize}
          onRowClick={(rec) => navigate(`/payroll/${rec._id}`)}
          emptyIcon={Wallet}
          emptyTitle="No payslips yet"
          emptyMessage="Payslips appear here once HR processes payroll for a month."
        />
      </Card>
    </div>
  );
}
