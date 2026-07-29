import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Modal from '../../components/Modal';
import Button from '../../components/Button';

const schema = z.object({
  name: z.string().min(2, 'Designation name is required'),
  code: z.string().min(2, 'Code is required').max(15, 'Code must be 15 characters or fewer'),
  department: z.string().min(1, 'Department is required'),
  description: z.string().optional(),
  status: z.enum(['active', 'inactive']),
});

export default function DesignationFormModal({ open, onClose, onSubmit, designation, departments, submitting }) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { name: '', code: '', department: '', description: '', status: 'active' },
  });

  useEffect(() => {
    if (open) {
      reset(
        designation
          ? {
              name: designation.name,
              code: designation.code,
              department: designation.department?._id || designation.department,
              description: designation.description || '',
              status: designation.status,
            }
          : { name: '', code: '', department: departments[0]?._id || '', description: '', status: 'active' }
      );
    }
  }, [open, designation, departments, reset]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={designation ? 'Edit Designation' : 'Add Designation'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit(onSubmit)} disabled={submitting}>
            {submitting ? 'Saving…' : designation ? 'Save changes' : 'Create designation'}
          </Button>
        </>
      }
    >
      <form className="space-y-3" onSubmit={handleSubmit(onSubmit)} noValidate>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
            Designation Name
          </label>
          <input
            {...register('name')}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            placeholder="e.g. Software Engineer"
          />
          {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Code</label>
          <input
            {...register('code')}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm uppercase outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            placeholder="e.g. SE"
          />
          {errors.code && <p className="mt-1 text-xs text-red-600">{errors.code.message}</p>}
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Department</label>
          <select
            {...register('department')}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          >
            {departments.length === 0 && <option value="">No departments yet</option>}
            {departments.map((d) => (
              <option key={d._id} value={d._id}>
                {d.name}
              </option>
            ))}
          </select>
          {errors.department && <p className="mt-1 text-xs text-red-600">{errors.department.message}</p>}
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
