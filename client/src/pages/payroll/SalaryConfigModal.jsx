import { useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Modal, Button, Input, FormField, Alert } from '../../components/ui';
import { formatCurrency } from '../../utils/format';

const money = (label) =>
  z.coerce
    .number({ invalid_type_error: `${label} must be a number` })
    .nonnegative(`${label} cannot be negative`)
    .max(1_000_000_000, `${label} is unrealistically large`)
    .refine((v) => Math.round(v * 100) === v * 100, `${label} can have at most 2 decimal places`);

const schema = z.object({
  basic: money('Basic'),
  hra: money('HRA'),
  allowances: money('Allowances'),
  deductions: money('Deductions'),
});

export default function SalaryConfigModal({ open, onClose, onSubmit, salary, employeeName, submitting, serverError }) {
  const firstRef = useRef(null);
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { basic: 0, hra: 0, allowances: 0, deductions: 0 },
  });

  useEffect(() => {
    if (open) {
      reset({
        basic: salary?.basic || 0,
        hra: salary?.hra || 0,
        allowances: salary?.allowances || 0,
        deductions: salary?.deductions || 0,
      });
    }
  }, [open, salary, reset]);

  const values = watch();
  const gross = Number(values.basic || 0) + Number(values.hra || 0) + Number(values.allowances || 0);
  const net = gross - Number(values.deductions || 0);
  const { ref: basicRef, ...basicField } = register('basic');

  return (
    <Modal
      open={open}
      onClose={submitting ? undefined : onClose}
      title="Salary structure"
      description={employeeName}
      size="sm"
      initialFocusRef={firstRef}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form="salary-form" loading={submitting}>
            Save salary
          </Button>
        </>
      }
    >
      <form id="salary-form" className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
        {serverError && <Alert tone="danger">{serverError}</Alert>}
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Basic" required error={errors.basic?.message}>
            <Input
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              {...basicField}
              ref={(el) => {
                basicRef(el);
                firstRef.current = el;
              }}
            />
          </FormField>
          <FormField label="HRA" required error={errors.hra?.message}>
            <Input type="number" step="0.01" min="0" inputMode="decimal" {...register('hra')} />
          </FormField>
          <FormField label="Allowances" required error={errors.allowances?.message}>
            <Input type="number" step="0.01" min="0" inputMode="decimal" {...register('allowances')} />
          </FormField>
          <FormField label="Deductions" required error={errors.deductions?.message}>
            <Input type="number" step="0.01" min="0" inputMode="decimal" {...register('deductions')} />
          </FormField>
        </div>

        <dl className="space-y-1.5 rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800/60">
          <div className="flex justify-between text-slate-600 dark:text-slate-300">
            <dt>Gross salary</dt>
            <dd className="font-medium tabular">{formatCurrency(gross, { precise: true })}</dd>
          </div>
          <div className="flex justify-between text-slate-600 dark:text-slate-300">
            <dt>Deductions</dt>
            <dd className="font-medium tabular">− {formatCurrency(Number(values.deductions || 0), { precise: true })}</dd>
          </div>
          <div className="flex justify-between border-t border-slate-200 pt-1.5 text-slate-900 dark:border-slate-700 dark:text-white">
            <dt className="font-medium">Net salary</dt>
            <dd className={`font-semibold tabular ${net < 0 ? 'text-red-600 dark:text-red-400' : 'text-primary-600 dark:text-primary-300'}`}>{formatCurrency(net, { precise: true })}</dd>
          </div>
        </dl>
        {net < 0 && <Alert tone="warning">Deductions exceed gross salary — the net will be negative.</Alert>}
        {salary?.effectiveFrom && <p className="text-xs text-slate-400">Current structure effective since {new Date(salary.effectiveFrom).toLocaleDateString()}</p>}
      </form>
    </Modal>
  );
}
