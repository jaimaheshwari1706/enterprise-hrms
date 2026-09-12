import { useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { employeeApi } from '../../api/employeeApi';
import { useApiQuery } from '../../hooks/useApiQuery';
import { Modal, Button, Input, Select, Textarea, FormField, Alert } from '../../components/ui';
import { fullName } from '../../utils/format';

const schema = z.object({
  name: z.string().trim().min(2, 'Department name is required').max(80),
  code: z.string().trim().min(2, 'Code is required').max(15, 'Code must be 15 characters or fewer'),
  description: z.string().trim().max(500).optional(),
  head: z.string().optional(),
  status: z.enum(['active', 'inactive']),
});

const EMPTY = { name: '', code: '', description: '', head: '', status: 'active' };

// `department` is null when creating, or an existing record when editing.
export default function DepartmentFormModal({ open, onClose, onSubmit, department, submitting, serverError }) {
  const firstFieldRef = useRef(null);
  const employees = useApiQuery((signal) => employeeApi.options({ signal }), [], { enabled: open });
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({ resolver: zodResolver(schema), defaultValues: EMPTY });

  useEffect(() => {
    if (open) {
      reset(
        department
          ? {
              name: department.name,
              code: department.code,
              description: department.description || '',
              head: department.head?._id || department.head || '',
              status: department.status,
            }
          : EMPTY
      );
    }
  }, [open, department, reset]);

  const { ref: nameRef, ...nameField } = register('name');

  return (
    <Modal
      open={open}
      onClose={submitting ? undefined : onClose}
      title={department ? 'Edit department' : 'New department'}
      description={department ? undefined : 'Departments group employees and their designations.'}
      initialFocusRef={firstFieldRef}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form="department-form" loading={submitting}>
            {department ? 'Save changes' : 'Create department'}
          </Button>
        </>
      }
    >
      <form id="department-form" className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
        {serverError && <Alert tone="danger">{serverError}</Alert>}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <FormField label="Department name" required error={errors.name?.message} className="sm:col-span-2">
            <Input
              placeholder="e.g. Engineering"
              {...nameField}
              ref={(el) => {
                nameRef(el);
                firstFieldRef.current = el;
              }}
            />
          </FormField>
          <FormField label="Code" required error={errors.code?.message} hint="Short, unique">
            <Input placeholder="ENG" className="uppercase" maxLength={15} {...register('code')} />
          </FormField>
        </div>
        <FormField label="Description" error={errors.description?.message}>
          <Textarea rows={2} placeholder="What this department is responsible for (optional)" {...register('description')} />
        </FormField>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Department head" hint="Optional">
            <Select {...register('head')}>
              <option value="">No head assigned</option>
              {(employees.data || []).map((e) => (
                <option key={e._id} value={e._id}>
                  {fullName(e)} ({e.employeeId})
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
      </form>
    </Modal>
  );
}
