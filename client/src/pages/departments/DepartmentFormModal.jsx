import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Modal from '../../components/Modal';
import Button from '../../components/Button';

const schema = z.object({
  name: z.string().min(2, 'Department name is required'),
  code: z.string().min(2, 'Code is required').max(15, 'Code must be 15 characters or fewer'),
  description: z.string().optional(),
  status: z.enum(['active', 'inactive']),
});

// `department` is null when creating, or an existing record when editing.
// Note: "Department Head" assignment is intentionally left out of this
// form until the Employee module (Phase 5) exists to pick a head from.
export default function DepartmentFormModal({ open, onClose, onSubmit, department, submitting }) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { name: '', code: '', description: '', status: 'active' },
  });

  useEffect(() => {
    if (open) {
      reset(
        department
          ? {
              name: department.name,
              code: department.code,
              description: department.description || '',
              status: department.status,
            }
          : { name: '', code: '', description: '', status: 'active' }
      );
    }
  }, [open, department, reset]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={department ? 'Edit Department' : 'Add Department'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit(onSubmit)} disabled={submitting}>
            {submitting ? 'Saving…' : department ? 'Save changes' : 'Create department'}
          </Button>
        </>
      }
    >
      <form className="space-y-3" onSubmit={handleSubmit(onSubmit)} noValidate>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
            Department Name
          </label>
          <input
            {...register('name')}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            placeholder="e.g. Engineering"
          />
          {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
            Department Code
          </label>
          <input
            {...register('code')}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm uppercase outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            placeholder="e.g. ENG"
          />
          {errors.code && <p className="mt-1 text-xs text-red-600">{errors.code.message}</p>}
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
            Description
          </label>
          <textarea
            {...register('description')}
            rows={2}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            placeholder="Optional"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Status</label>
          <select
            {...register('status')}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </form>
    </Modal>
  );
}
