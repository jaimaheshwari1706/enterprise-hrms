import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Pencil, CalendarOff } from 'lucide-react';
import { leaveApi } from '../../api/leaveApi';
import { useToast } from '../../hooks/useToast';
import { useApiQuery } from '../../hooks/useApiQuery';
import { Button, Input, Textarea, FormField, Card, CardHeader, IconButton, Modal, Alert, Badge, ErrorState, Skeleton, EmptyState } from '../../components/ui';
import { getApiErrorMessage } from '../../utils/apiError';

const schema = z.object({
  name: z.string().trim().min(2, 'Name is required').max(60),
  defaultDaysPerYear: z.coerce.number().int('Whole days only').min(0).max(366),
  description: z.string().trim().max(300).optional(),
  isPaid: z.boolean(),
});

function LeaveTypeModal({ open, onClose, initial, onSaved }) {
  const { showToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const form = useForm({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (open) {
      form.reset({
        name: initial?.name || '',
        defaultDaysPerYear: initial?.defaultDaysPerYear ?? 12,
        description: initial?.description || '',
        isPaid: initial ? initial.isPaid !== false : true,
      });
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial]);

  const submit = async (values) => {
    setSaving(true);
    setError(null);
    try {
      const { data } = initial ? await leaveApi.updateLeaveType(initial._id, values) : await leaveApi.createLeaveType(values);
      onSaved(data.data);
      showToast(initial ? 'Leave type updated' : 'Leave type created');
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Unable to save the leave type.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={saving ? undefined : onClose}
      title={initial ? `Edit ${initial.name}` : 'New leave type'}
      description="Allocation applies per employee per calendar year."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="leave-type-form" loading={saving}>
            {initial ? 'Save changes' : 'Create leave type'}
          </Button>
        </>
      }
    >
      <form id="leave-type-form" className="space-y-4" onSubmit={form.handleSubmit(submit)} noValidate>
        {error && <Alert tone="danger">{error}</Alert>}
        <FormField label="Name" required error={form.formState.errors.name?.message}>
          <Input {...form.register('name')} />
        </FormField>
        <FormField label="Days per year" required error={form.formState.errors.defaultDaysPerYear?.message}>
          <Input type="number" min={0} max={366} step={1} {...form.register('defaultDaysPerYear')} />
        </FormField>
        <FormField label="Description" error={form.formState.errors.description?.message}>
          <Textarea rows={2} maxLength={300} {...form.register('description')} />
        </FormField>
        <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-800">
          <input type="checkbox" className="mt-0.5 h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500" {...form.register('isPaid')} />
          <span>
            <span className="font-medium text-slate-900 dark:text-white">Paid leave</span>
            <span className="block text-xs text-slate-500 dark:text-slate-400">
              Uncheck for loss-of-pay leave. Unpaid days reduce payable days only when the payroll policy enables it.
            </span>
          </span>
        </label>
      </form>
    </Modal>
  );
}

export default function LeaveTypesCard() {
  const types = useApiQuery((signal) => leaveApi.leaveTypes({ signal }), []);
  const [editing, setEditing] = useState(null); // null | 'new' | leaveType
  const rows = types.data || [];

  const onSaved = (saved) => {
    types.setData((prev) => {
      const list = prev || [];
      const exists = list.some((t) => t._id === saved._id);
      const next = exists ? list.map((t) => (t._id === saved._id ? saved : t)) : [...list, saved];
      return next.sort((a, b) => a.name.localeCompare(b.name));
    });
  };

  return (
    <Card>
      <CardHeader
        title="Leave types"
        description="Annual allocations and whether each type is paid. Existing requests keep the days they were charged."
        actions={
          <Button size="sm" icon={Plus} onClick={() => setEditing('new')}>
            New type
          </Button>
        }
      />
      {types.status === 'loading' ? (
        <div className="space-y-3 p-5" role="status" aria-label="Loading leave types">
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
        </div>
      ) : types.status === 'error' ? (
        <ErrorState compact message={types.error} onRetry={types.refetch} />
      ) : rows.length === 0 ? (
        <EmptyState compact icon={CalendarOff} title="No leave types yet" message="Create the leave types employees can request." />
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {rows.map((t) => (
            <li key={t._id} className="flex items-center gap-3 px-5 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-slate-900 dark:text-white">{t.name}</p>
                  <Badge tone={t.isPaid === false ? 'warning' : 'success'}>{t.isPaid === false ? 'Unpaid' : 'Paid'}</Badge>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {t.defaultDaysPerYear} day{t.defaultDaysPerYear === 1 ? '' : 's'} per year
                  {t.description ? ` · ${t.description}` : ''}
                </p>
              </div>
              <IconButton label={`Edit ${t.name}`} icon={Pencil} onClick={() => setEditing(t)} />
            </li>
          ))}
        </ul>
      )}
      <LeaveTypeModal open={editing !== null} onClose={() => setEditing(null)} initial={editing === 'new' ? null : editing} onSaved={onSaved} />
    </Card>
  );
}
