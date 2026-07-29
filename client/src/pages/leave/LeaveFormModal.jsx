import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Modal from '../../components/Modal';
import Button from '../../components/Button';

const schema = z
  .object({
    leaveType: z.string().min(1, 'Leave type is required'),
    startDate: z.string().min(1, 'Start date is required'),
    endDate: z.string().min(1, 'End date is required'),
    reason: z.string().min(3, 'Please provide a short reason'),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: 'End date cannot be before start date',
    path: ['endDate'],
  });

export default function LeaveFormModal({ open, onClose, onSubmit, leaveTypes, submitting }) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (open) {
      reset({ leaveType: leaveTypes[0]?._id || '', startDate: '', endDate: '', reason: '' });
    }
  }, [open, leaveTypes, reset]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Apply for Leave"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit(onSubmit)} disabled={submitting}>
            {submitting ? 'Submitting…' : 'Submit request'}
          </Button>
        </>
      }
    >
      <form className="space-y-3" onSubmit={handleSubmit(onSubmit)} noValidate>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Leave Type</label>
          <select
            {...register('leaveType')}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          >
            {leaveTypes.map((t) => (
              <option key={t._id} value={t._id}>{t.name}</option>
            ))}
          </select>
          {errors.leaveType && <p className="mt-1 text-xs text-red-600">{errors.leaveType.message}</p>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Start Date</label>
            <input
              type="date"
              {...register('startDate')}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
            {errors.startDate && <p className="mt-1 text-xs text-red-600">{errors.startDate.message}</p>}
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">End Date</label>
            <input
              type="date"
              {...register('endDate')}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
            {errors.endDate && <p className="mt-1 text-xs text-red-600">{errors.endDate.message}</p>}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Reason</label>
          <textarea
            {...register('reason')}
            rows={3}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            placeholder="Briefly describe why you're requesting this leave"
          />
          {errors.reason && <p className="mt-1 text-xs text-red-600">{errors.reason.message}</p>}
        </div>
      </form>
    </Modal>
  );
}
