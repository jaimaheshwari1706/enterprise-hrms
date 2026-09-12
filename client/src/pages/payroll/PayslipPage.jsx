import { useNavigate, useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { ArrowLeft, Printer } from 'lucide-react';
import { payrollApi } from '../../api/payrollApi';
import { selectIsHR } from '../../features/auth/authSlice';
import { useApiQuery } from '../../hooks/useApiQuery';
import { Button, PageHeader, StatusBadge, ErrorState, Skeleton } from '../../components/ui';
import { formatCurrency, formatDate, formatMonth, fullName } from '../../utils/format';

const BASIS_LABEL = { none: 'Fixed monthly', calendar: 'Calendar days', working: 'Working days' };

function Row({ label, value, strong = false }) {
  return (
    <tr className={strong ? 'font-semibold text-slate-900 dark:text-white print:text-black' : 'text-slate-700 dark:text-slate-200 print:text-black'}>
      <td className="py-1.5 pr-4">{label}</td>
      <td className="py-1.5 text-right tabular">{value}</td>
    </tr>
  );
}

function Field({ label, children }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400 print:text-slate-600">{label}</dt>
      <dd className="break-words text-sm text-slate-900 dark:text-white print:text-black">{children || '—'}</dd>
    </div>
  );
}

// A printable payslip. "Download" uses the browser's print-to-PDF: no
// PDF library ships to the client and the print stylesheet in index.css
// hides the app chrome so the sheet prints on its own.
export default function PayslipPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isHR = useSelector(selectIsHR);
  const payslip = useApiQuery((signal) => payrollApi.get(id, { signal }), [id]);
  const rec = payslip.data;
  const backTo = isHR ? '/payroll/manage' : '/payroll';

  if (payslip.status === 'loading') {
    return (
      <div className="mx-auto max-w-3xl space-y-4" aria-busy="true">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-[640px] w-full" />
      </div>
    );
  }
  if (payslip.status === 'error' || !rec) {
    return (
      <div className="mx-auto max-w-3xl">
        <ErrorState message={payslip.error || 'Payslip not found.'} onRetry={payslip.refetch} />
        <div className="text-center">
          <Button variant="secondary" icon={ArrowLeft} onClick={() => navigate(backTo)}>
            Back to payroll
          </Button>
        </div>
      </div>
    );
  }

  const employee = rec.employee || {};
  const org = rec.organization || {};
  const period = rec.period || {};
  const proRated = period.basis && period.basis !== 'none' && period.factor !== 1;
  const paidOn = rec.paidAt || (rec.status === 'Paid' ? rec.updatedAt : null);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="print:hidden">
        <PageHeader
          title={`Payslip · ${formatMonth(rec.month)}`}
          description={rec.payslipNumber ? `Reference ${rec.payslipNumber}` : undefined}
          breadcrumb={[{ label: isHR ? 'Payroll management' : 'My payroll', to: backTo }, { label: formatMonth(rec.month) }]}
          actions={
            <>
              <Button variant="secondary" icon={ArrowLeft} onClick={() => navigate(backTo)}>
                Back
              </Button>
              <Button icon={Printer} onClick={() => window.print()}>
                Print / Save PDF
              </Button>
            </>
          }
        />
      </div>

      <article
        aria-label={`Payslip for ${fullName(employee)} for ${formatMonth(rec.month)}`}
        className="payslip-sheet ui-card overflow-hidden print:rounded-none print:border-0 print:shadow-none"
      >
        {/* Header */}
        <header className="flex flex-col gap-4 border-b border-slate-200 p-6 sm:flex-row sm:items-start sm:justify-between dark:border-slate-800 print:border-slate-300">
          <div className="flex items-center gap-3">
            {org.logoUrl ? (
              <img src={org.logoUrl} alt="" className="h-12 w-12 rounded-lg object-contain" />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary-600 text-lg font-bold text-white print:bg-slate-800" aria-hidden="true">
                {(org.name || 'O').charAt(0)}
              </div>
            )}
            <div>
              <p className="text-base font-semibold text-slate-900 dark:text-white print:text-black">{org.name || 'Organization'}</p>
              {org.address && <p className="max-w-xs text-xs text-slate-500 dark:text-slate-400 print:text-slate-600">{org.address}</p>}
              {(org.email || org.phone) && (
                <p className="text-xs text-slate-500 dark:text-slate-400 print:text-slate-600">{[org.email, org.phone].filter(Boolean).join(' · ')}</p>
              )}
            </div>
          </div>
          <div className="sm:text-right">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400 print:text-slate-600">Payslip</p>
            <p className="text-xl font-semibold text-slate-900 dark:text-white print:text-black">{formatMonth(rec.month)}</p>
            {rec.payslipNumber && <p className="text-xs text-slate-500 dark:text-slate-400 print:text-slate-600">No. {rec.payslipNumber}</p>}
            <div className="mt-1 print:hidden">
              <StatusBadge status={rec.status} />
            </div>
            <p className="hidden text-xs text-slate-600 print:block">Status: {rec.status}</p>
          </div>
        </header>

        {/* Employee + period */}
        <div className="grid grid-cols-1 gap-6 border-b border-slate-200 p-6 sm:grid-cols-2 dark:border-slate-800 print:border-slate-300">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
            <Field label="Employee">{fullName(employee)}</Field>
            <Field label="Employee ID">{employee.employeeId}</Field>
            <Field label="Designation">{employee.designation?.name}</Field>
            <Field label="Department">{employee.department?.name}</Field>
            <Field label="Email">{employee.email}</Field>
            <Field label="Joined">{formatDate(employee.joiningDate)}</Field>
          </dl>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
            <Field label="Pay period">
              {period.from && period.to ? `${formatDate(period.from)} – ${formatDate(period.to)}` : formatMonth(rec.month)}
            </Field>
            <Field label="Pay basis">{BASIS_LABEL[period.basis] || BASIS_LABEL.none}</Field>
            <Field label="Payable days">
              {period.payableDays != null && period.totalDays != null ? `${period.payableDays} of ${period.totalDays}` : '—'}
            </Field>
            <Field label="Unpaid leave">{period.unpaidLeaveDays ? `${period.unpaidLeaveDays} day${period.unpaidLeaveDays === 1 ? '' : 's'}` : 'None'}</Field>
            <Field label="Paid on">{paidOn ? formatDate(paidOn) : 'Pending'}</Field>
            <Field label="Generated">{formatDate(rec.createdAt)}</Field>
          </dl>
        </div>

        {/* Earnings / deductions */}
        <div className="grid grid-cols-1 gap-6 p-6 sm:grid-cols-2">
          <section aria-labelledby="payslip-earnings">
            <h2 id="payslip-earnings" className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 print:text-slate-600">
              Earnings
            </h2>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 print:divide-slate-300">
                <Row label="Basic salary" value={formatCurrency(rec.basic, { precise: true })} />
                <Row label="House rent allowance" value={formatCurrency(rec.hra, { precise: true })} />
                <Row label="Other allowances" value={formatCurrency(rec.allowances, { precise: true })} />
                <Row label="Gross earnings" value={formatCurrency(rec.grossSalary, { precise: true })} strong />
              </tbody>
            </table>
          </section>
          <section aria-labelledby="payslip-deductions">
            <h2 id="payslip-deductions" className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 print:text-slate-600">
              Deductions
            </h2>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 print:divide-slate-300">
                <Row label="Statutory & other deductions" value={formatCurrency(rec.deductions, { precise: true })} />
                <Row label="Total deductions" value={formatCurrency(rec.deductions, { precise: true })} strong />
              </tbody>
            </table>
          </section>
        </div>

        {/* Net */}
        <div className="flex flex-col gap-1 border-t border-slate-200 bg-slate-50 px-6 py-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800 dark:bg-slate-800/40 print:border-slate-300 print:bg-white">
          <div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200 print:text-black">Net pay</p>
            {proRated && (
              <p className="text-xs text-slate-500 dark:text-slate-400 print:text-slate-600">
                Pro-rated: {period.payableDays} of {period.totalDays} {period.basis === 'working' ? 'working' : 'calendar'} days
                {period.unpaidLeaveDays ? ` (${period.unpaidLeaveDays} unpaid leave)` : ''}
              </p>
            )}
          </div>
          <p className="text-2xl font-semibold tabular text-slate-900 dark:text-white print:text-black">{formatCurrency(rec.netSalary, { precise: true })}</p>
        </div>

        <footer className="border-t border-slate-200 px-6 py-3 text-[11px] text-slate-500 dark:border-slate-800 dark:text-slate-400 print:border-slate-300 print:text-slate-600">
          This is a computer-generated payslip and does not require a signature. Amounts are shown in the organization&apos;s payroll currency.
        </footer>
      </article>
    </div>
  );
}
