import { useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Modal, Button, Input, Select, Textarea, FormField, Alert } from '../../components/ui';

const schema = z.object({
  name: z.string().trim().min(2, 'Designation name is required').max(80),
  code: z.string().trim().min(2, 'Code is required').max(15, 'Code must be 15 characters or fewer'),
  department: z.string().min(1, 'Department is required'),
  description: z.string().trim().max(500).optional(),
  status: z.enum(['active', 'inactive']),
});

export default function DesignationFormModal({ open, onClose, onSubmit, designation, departments, submitting, serverError }) {
  const firstFieldRef = useRef(null);
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

  const { ref: nameRef, ...nameField } = register('name');

  return (
    <Modal
      open={open}
      onClose={submitting ? undefined : onClose}
      title={designation ? 'Edit designation' : 'New designation'}
      initialFocusRef={firstFieldRef}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form="designation-form" loading={submitting}>
            {designation ? 'Save changes' : 'Create designation'}
          </Button>
        </>
      }
    >
      <form id="designation-form" className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
        {serverError && <Alert tone="danger">{serverError}</Alert>}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <FormField label="Designation name" required error={errors.name?.message} className="sm:col-span-2">
            <Input
              placeholder="e.g. Software Engineer"
              {...nameField}
              ref={(el) => {
                nameRef(el);
                firstFieldRef.current = el;
              }}
            />
          </FormField>
          <FormField label="Code" required error={errors.code?.message}>
            <Input placeholder="SE" className="uppercase" maxLength={15} {...register('code')} />
          </FormField>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Department" required error={errors.department?.message}>
            <Select {...register('department')}>
              {departments.length === 0 && <option value="">No departments yet</option>}
              {departments.map((d) => (
                <option key={d._id} value={d._id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Status" required>
            <Select {...register('status')}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </Select>
          </FormField>
        </div>
        <FormField label="Description" error={errors.description?.message}>
          <Textarea rows={2} placeholder="Optional" {...register('description')} />
        </FormField>
      </form>
    </Modal>
  );
}
