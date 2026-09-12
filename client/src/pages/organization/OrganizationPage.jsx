import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Upload, Save, Building2, CalendarDays, CalendarOff, Wallet } from 'lucide-react';
import clsx from 'clsx';
import { organizationApi } from '../../api/organizationApi';
import { useToast } from '../../hooks/useToast';
import { useApiQuery } from '../../hooks/useApiQuery';
import { Button, Input, Select, FormField, Card, CardHeader, PageHeader, FormSkeleton, Alert, ErrorState, Tabs } from '../../components/ui';
import { getApiErrorMessage, getApiFieldErrors } from '../../utils/apiError';
import HolidaysCard from './HolidaysCard';
import LeaveTypesCard from './LeaveTypesCard';
import PayrollPolicyCard from './PayrollPolicyCard';

const TABS = [
  { value: 'general', label: 'General', icon: Building2 },
  { value: 'calendar', label: 'Calendar', icon: CalendarDays },
  { value: 'leave', label: 'Leave types', icon: CalendarOff },
  { value: 'payroll', label: 'Payroll policy', icon: Wallet },
];

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const TIMEZONES = (() => {
  try {
    return Intl.supportedValuesOf('timeZone');
  } catch {
    return ['UTC', 'Asia/Kolkata', 'Europe/London', 'America/New_York', 'America/Los_Angeles', 'Asia/Singapore', 'Australia/Sydney'];
  }
})();

const schema = z
  .object({
    name: z.string().trim().min(2, 'Organization name is required').max(120),
    email: z.string().trim().email('Enter a valid email').or(z.literal('')),
    phone: z.string().trim().max(30).optional(),
    address: z.string().trim().max(300).optional(),
    country: z.string().trim().max(100).optional(),
    timezone: z.string().min(1, 'Timezone is required'),
    officeStartTime: z.string().optional(),
    officeEndTime: z.string().optional(),
  })
  .refine((d) => !d.officeStartTime || !d.officeEndTime || d.officeStartTime < d.officeEndTime, {
    message: 'End time must be after start time',
    path: ['officeEndTime'],
  });

export default function OrganizationPage() {
  const { showToast } = useToast();
  const fileInputRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [logoUrl, setLogoUrl] = useState('');
  const [workingDays, setWorkingDays] = useState([]);
  const [serverError, setServerError] = useState(null);
  const [tab, setTab] = useState('general');

  const org = useApiQuery((signal) => organizationApi.get({ signal }), []);
  // Sub-cards save independently and hand back the updated document.
  const onSaved = (updated) => org.setData(updated);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isDirty },
  } = useForm({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (!org.data) return;
    const o = org.data;
    reset({
      name: o.name,
      email: o.email || '',
      phone: o.phone || '',
      address: o.address || '',
      country: o.country || '',
      timezone: o.timezone || 'Asia/Kolkata',
      officeStartTime: o.officeStartTime || '',
      officeEndTime: o.officeEndTime || '',
    });
    setLogoUrl(o.logoUrl || '');
    setWorkingDays(o.workingDays || []);
  }, [org.data, reset]);

  const toggleDay = (day) => {
    setWorkingDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : WEEKDAYS.filter((d) => d === day || prev.includes(d))));
  };

  const onSubmit = async (values) => {
    if (workingDays.length === 0) {
      setServerError('Select at least one working day.');
      return;
    }
    setSaving(true);
    setServerError(null);
    try {
      const { data } = await organizationApi.update({ ...values, workingDays });
      showToast('Organization settings saved');
      setLogoUrl(data.data.logoUrl || '');
      org.setData(data.data);
      reset(values);
    } catch (err) {
      const fieldErrors = getApiFieldErrors(err);
      for (const [field, message] of Object.entries(fieldErrors)) {
        if (field in values) setError(field, { type: 'server', message });
      }
      setServerError(getApiErrorMessage(err, 'Unable to save settings.'));
    } finally {
      setSaving(false);
    }
  };

  const handleLogoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { data } = await organizationApi.uploadLogo(file);
      setLogoUrl(data.data.logoUrl);
      showToast('Logo updated');
    } catch (err) {
      showToast(getApiErrorMessage(err, 'Unable to upload the logo.'), 'error');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  if (org.status === 'loading') {
    return (
      <div className="max-w-3xl">
        <PageHeader title="Organization Settings" />
        <FormSkeleton fields={8} />
      </div>
    );
  }
  if (org.status === 'error') {
    return (
      <div className="max-w-3xl">
        <PageHeader title="Organization Settings" />
        <Card>
          <ErrorState message={org.error} onRetry={org.refetch} />
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <PageHeader title="Organization Settings" description="Company identity, working calendar, leave types and payroll rules." />

      <Tabs tabs={TABS} value={tab} onChange={setTab} className="mb-5" />

      {tab === 'calendar' && (
        <div className="space-y-5">
          <HolidaysCard key={org.data.updatedAt} organization={org.data} onSaved={onSaved} />
          <Alert tone="info">
            The working week is edited under <button type="button" className="font-medium underline" onClick={() => setTab('general')}>General</button>. Weekends and holidays are never charged as leave and never count as absent.
          </Alert>
        </div>
      )}
      {tab === 'leave' && <LeaveTypesCard />}
      {tab === 'payroll' && <PayrollPolicyCard key={org.data.updatedAt} organization={org.data} onSaved={onSaved} />}

      {tab === 'general' && (
      <>
      <Card className="mb-5">
        <CardHeader title="Branding" />
        <div className="flex items-center gap-4 p-5">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100 ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
            {logoUrl ? <img src={logoUrl} alt="Organization logo" className="h-full w-full object-cover" /> : <Building2 size={24} className="text-slate-400" aria-hidden="true" />}
          </div>
          <div>
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleLogoChange} />
            <Button variant="secondary" icon={Upload} onClick={() => fileInputRef.current?.click()} loading={uploading}>
              {logoUrl ? 'Replace logo' : 'Upload logo'}
            </Button>
            <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">JPG, PNG or WEBP · up to 2MB · square works best</p>
          </div>
        </div>
      </Card>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        {serverError && <Alert tone="danger">{serverError}</Alert>}
        <Card>
          <CardHeader title="Company details" />
          <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
            <FormField label="Organization name" required error={errors.name?.message} className="sm:col-span-2">
              <Input {...register('name')} />
            </FormField>
            <FormField label="Contact email" error={errors.email?.message}>
              <Input type="email" {...register('email')} />
            </FormField>
            <FormField label="Phone" error={errors.phone?.message}>
              <Input type="tel" {...register('phone')} />
            </FormField>
            <FormField label="Address" error={errors.address?.message} className="sm:col-span-2">
              <Input {...register('address')} />
            </FormField>
            <FormField label="Country" error={errors.country?.message}>
              <Input {...register('country')} />
            </FormField>
            <FormField label="Timezone" required error={errors.timezone?.message} hint="Attendance days and leave dates are decided in this timezone">
              <Select {...register('timezone')}>
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>
        </Card>

        <Card>
          <CardHeader title="Working hours" description="Reference hours shown to employees; a full day is recorded at 8 hours worked." />
          <div className="space-y-4 p-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="Office start time" error={errors.officeStartTime?.message}>
                <Input type="time" {...register('officeStartTime')} />
              </FormField>
              <FormField label="Office end time" error={errors.officeEndTime?.message}>
                <Input type="time" {...register('officeEndTime')} />
              </FormField>
            </div>
            <fieldset>
              <legend className="mb-2 block text-xs font-medium text-slate-700 dark:text-slate-300">Working days</legend>
              <div className="flex flex-wrap gap-2">
                {WEEKDAYS.map((day) => {
                  const on = workingDays.includes(day);
                  return (
                    <button
                      type="button"
                      key={day}
                      onClick={() => toggleDay(day)}
                      aria-pressed={on}
                      className={clsx(
                        'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                        on
                          ? 'border-primary-600 bg-primary-600 text-white'
                          : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
                      )}
                    >
                      {day.slice(0, 3)}
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{workingDays.length} working day{workingDays.length === 1 ? '' : 's'} per week</p>
            </fieldset>
          </div>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" icon={Save} loading={saving} disabled={!isDirty && workingDays.join() === (org.data?.workingDays || []).join()}>
            Save changes
          </Button>
        </div>
      </form>
      </>
      )}
    </div>
  );
}
