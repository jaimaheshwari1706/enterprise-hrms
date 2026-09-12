import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { leaveApi } from '../../api/leaveApi';
import { Modal, Button, Input, Select, Textarea, FormField, Alert } from '../../components/ui';
import { isCancelledRequest } from '../../utils/apiError';

const schema = z
  .object({
    leaveType: z.string().min(1, 'Leave type is required'),
    startDate: z.string().min(1, 'Start date is required'),
    endDate: z.string().min(1, 'End date is required'),
    reason: z.string().trim().min(3, 'Please provide a short reason').max(500, 'Keep the reason under 500 characters'),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: 'End date cannot be before start date',
    path: ['endDate'],
  });

// Asks the server how many working days a range is charged (weekends and
// holidays excluded by the organization's calendar) so the number shown
// here is exactly the number that will be stored.
function useLeavePreview(startDate, endDate) {
  const [preview, setPreview] = useState(null);
  const valid = startDate && endDate && endDate >= startDate;

  useEffect(() => {
    if (!valid) {
      setPreview(null);
      return undefined;
    }
    const controller = new AbortController();
    leaveApi
      .preview(startDate, endDate, { signal: controller.signal })
      .then(({ data }) => setPreview(data.data))
      .catch((err) => {
        if (!isCancelledRequest(err)) setPreview(null);
      });
    return () => controller.abort();
  }, [valid, startDate, endDate]);

  return valid ? preview : null;
}

function describePreview(preview) {
  const parts = [];
  if (preview.weekendDays) parts.push(`${preview.weekendDays} weekend day${preview.weekendDays === 1 ? '' : 's'}`);
  if (preview.holidayDays) parts.push(`${preview.holidayDays} holiday${preview.holidayDays === 1 ? '' : 's'} (${preview.holidays.join(', ')})`);
  return parts.length ? ` — ${parts.join(' and ')} not counted` : '';
}

export default function LeaveFormModal({ open, onClose, onSubmit, leaveTypes, balance = [], submitting, serverError }) {
  const firstFieldRef = useRef(null);
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (open) {
      reset({ leaveType: leaveTypes[0]?._id || '', startDate: '', endDate: '', reason: '' });
    }
  }, [open, leaveTypes, reset]);

  const [leaveType, startDate, endDate] = watch(['leaveType', 'startDate', 'endDate']);
  const preview = useLeavePreview(startDate, endDate);
  const days = preview?.days ?? 0;
  const selectedBalance = useMemo(() => balance.find((b) => b.leaveTypeId === leaveType), [balance, leaveType]);
  const selectedType = useMemo(() => leaveTypes.find((t) => t._id === leaveType), [leaveTypes, leaveType]);
  const exceeds = Boolean(selectedBalance && days > selectedBalance.remaining);
  const noWorkingDays = Boolean(preview && preview.days === 0);

  const { ref: typeRef, ...typeField } = register('leaveType');

  return (
    <Modal
      open={open}
      onClose={submitting ? undefined : onClose}
      title="Apply for leave"
      description="Your manager (or HR, if you have no manager) will review the request."
      initialFocusRef={firstFieldRef}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form="leave-form" loading={submitting} disabled={exceeds || noWorkingDays}>
            Submit request
          </Button>
        </>
      }
    >
      <form id="leave-form" className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
        {serverError && <Alert tone="danger">{serverError}</Alert>}

        <FormField
          label="Leave type"
          required
          error={errors.leaveType?.message}
          hint={
            selectedBalance
              ? `${selectedBalance.remaining} of ${selectedBalance.allocated} days remaining this year${selectedType?.isPaid === false ? ' · unpaid leave' : ''}`
              : undefined
          }
        >
          <Select
            {...typeField}
            ref={(el) => {
              typeRef(el);
              firstFieldRef.current = el;
            }}
          >
            {leaveTypes.map((t) => (
              <option key={t._id} value={t._id}>
                {t.name}
                {t.isPaid === false ? ' (unpaid)' : ''}
              </option>
            ))}
          </Select>
        </FormField>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Start date" required error={errors.startDate?.message}>
            <Input type="date" max={endDate || undefined} {...register('startDate')} />
          </FormField>
          <FormField label="End date" required error={errors.endDate?.message}>
            <Input type="date" min={startDate || undefined} {...register('endDate')} />
          </FormField>
        </div>

        {preview && (
          <Alert tone={exceeds || noWorkingDays ? 'danger' : 'info'} role="status">
            {noWorkingDays
              ? 'The selected dates contain no working days — weekends and holidays are not counted as leave.'
              : exceeds
                ? `This request needs ${days} working day${days === 1 ? '' : 's'} but only ${selectedBalance.remaining} remain for ${selectedBalance.leaveType}.`
                : `${days} working day${days === 1 ? '' : 's'} will be requested${describePreview(preview)}.`}
          </Alert>
        )}

        <FormField label="Reason" required error={errors.reason?.message}>
          <Textarea rows={3} placeholder="Briefly describe why you're requesting this leave" maxLength={500} {...register('reason')} />
        </FormField>
      </form>
    </Modal>
  );
}
