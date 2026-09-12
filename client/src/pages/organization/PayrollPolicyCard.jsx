import { useState } from 'react';
import { Save } from 'lucide-react';
import clsx from 'clsx';
import { organizationApi } from '../../api/organizationApi';
import { useToast } from '../../hooks/useToast';
import { Button, Card, CardHeader, Alert } from '../../components/ui';
import { getApiErrorMessage } from '../../utils/apiError';

const BASES = [
  {
    value: 'none',
    label: 'Fixed monthly salary',
    description: 'Every employee receives the full monthly structure regardless of joining or exit date. Days are still recorded on the payslip.',
  },
  {
    value: 'calendar',
    label: 'Pro-rate by calendar days',
    description: 'Salary × days employed in the month ÷ days in the month (e.g. joined on the 10th of a 31-day month → 22/31).',
  },
  {
    value: 'working',
    label: 'Pro-rate by working days',
    description: 'Salary × working days employed ÷ working days in the month, using the working week and holidays configured above.',
  },
];

// The payroll rules that are a business decision rather than a fact of the
// data. Nothing here changes payroll that has already been generated.
export default function PayrollPolicyCard({ organization, onSaved }) {
  const { showToast } = useToast();
  const initial = { proRataBasis: organization.payrollPolicy?.proRataBasis || 'none', deductUnpaidLeave: Boolean(organization.payrollPolicy?.deductUnpaidLeave) };
  const [policy, setPolicy] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const dirty = policy.proRataBasis !== initial.proRataBasis || policy.deductUnpaidLeave !== initial.deductUnpaidLeave;
  const unpaidDisabled = policy.proRataBasis === 'none';

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const { data } = await organizationApi.update({ name: organization.name, payrollPolicy: policy });
      onSaved(data.data);
      showToast('Payroll policy saved');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Unable to save the payroll policy.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader
        title="Payroll policy"
        description="Applies to payroll generated from now on. Existing Draft, Processed and Paid records are never recalculated."
        actions={
          <Button size="sm" icon={Save} loading={saving} disabled={!dirty} onClick={save}>
            Save policy
          </Button>
        }
      />
      <div className="space-y-5 p-5">
        {error && <Alert tone="danger">{error}</Alert>}

        <fieldset>
          <legend className="mb-2 text-xs font-medium text-slate-700 dark:text-slate-300">Partial months (joining, exit)</legend>
          <div className="space-y-2">
            {BASES.map((basis) => {
              const on = policy.proRataBasis === basis.value;
              return (
                <label
                  key={basis.value}
                  className={clsx(
                    'flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors',
                    on ? 'border-primary-500 bg-primary-50/60 dark:border-primary-400 dark:bg-primary-500/10' : 'border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/40'
                  )}
                >
                  <input
                    type="radio"
                    name="proRataBasis"
                    value={basis.value}
                    checked={on}
                    onChange={() => setPolicy((p) => ({ ...p, proRataBasis: basis.value, deductUnpaidLeave: basis.value === 'none' ? false : p.deductUnpaidLeave }))}
                    className="mt-0.5 h-4 w-4 border-slate-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span>
                    <span className="block text-sm font-medium text-slate-900 dark:text-white">{basis.label}</span>
                    <span className="block text-xs text-slate-500 dark:text-slate-400">{basis.description}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <label className={clsx('flex items-start gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-800', unpaidDisabled && 'opacity-60')}>
          <input
            type="checkbox"
            checked={policy.deductUnpaidLeave}
            disabled={unpaidDisabled}
            onChange={(e) => setPolicy((p) => ({ ...p, deductUnpaidLeave: e.target.checked }))}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
          />
          <span>
            <span className="block text-sm font-medium text-slate-900 dark:text-white">Deduct approved unpaid leave</span>
            <span className="block text-xs text-slate-500 dark:text-slate-400">
              Working days of approved leave on an <em>unpaid</em> leave type reduce payable days. Requires a pro-rata basis.
            </span>
          </span>
        </label>

        <p className="text-xs text-slate-500 dark:text-slate-400">
          All salary components, including deductions, scale by the same payable-day factor and are rounded to two decimals.
        </p>
      </div>
    </Card>
  );
}
