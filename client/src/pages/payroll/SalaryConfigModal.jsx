import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Modal from '../../components/Modal';
import Button from '../../components/Button';

const schema = z.object({
  basic: z.coerce.number().nonnegative('Must be 0 or more'),
  hra: z.coerce.number().nonnegative('Must be 0 or more'),
  allowances: z.coerce.number().nonnegative('Must be 0 or more'),
  deductions: z.coerce.number().nonnegative('Must be 0 or more'),
});

const inputClass =
  'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white';

export default function SalaryConfigModal({ open, onClose, onSubmit, salary, employeeName, submitting }) {
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

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Configure Salary${employeeName ? ` — ${employeeName}` : ''}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit(onSubmit)} disabled={submitting}>
            {submitting ? 'Saving…' : 'Save salary'}
          </Button>
        </>
      }
    >
      <form className="space-y-3" onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Basic</label>
            <input type="number" step="0.01" {...register('basic')} className={inputClass} />
            {errors.basic && <p className="mt-1 text-xs text-red-600">{errors.basic.message}</p>}
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">HRA</label>
            <input type="number" step="0.01" {...register('hra')} className={inputClass} />
            {errors.hra && <p className="mt-1 text-xs text-red-600">{errors.hra.message}</p>}
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Allowances</label>
            <input type="number" step="0.01" {...register('allowances')} className={inputClass} />
            {errors.allowances && <p className="mt-1 text-xs text-red-600">{errors.allowances.message}</p>}
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Deductions</label>
            <input type="number" step="0.01" {...register('deductions')} className={inputClass} />
            {errors.deductions && <p className="mt-1 text-xs text-red-600">{errors.deductions.message}</p>}
          </div>
        </div>

        <div className="rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800">
          <div className="flex justify-between text-slate-600 dark:text-slate-300">
            <span>Gross Salary</span>
            <span className="font-medium">{gross.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-slate-600 dark:text-slate-300">
            <span>Net Salary</span>
            <span className="font-medium text-indigo-600 dark:text-indigo-400">{net.toLocaleString()}</span>
          </div>
        </div>
      </form>
    </Modal>
  );
}
