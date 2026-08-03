import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Upload } from 'lucide-react';
import { organizationApi } from '../../api/organizationApi';
import { useToast } from '../../hooks/useToast';
import Button from '../../components/Button';
import { Loading } from '../../components/StateViews';

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const schema = z.object({
  name: z.string().min(2, 'Organization name is required'),
  email: z.string().email('Enter a valid email').or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
  country: z.string().optional(),
  timezone: z.string().optional(),
  officeStartTime: z.string().optional(),
  officeEndTime: z.string().optional(),
});

export default function OrganizationPage() {
  const { showToast } = useToast();
  const fileInputRef = useRef(null);

  const [status, setStatus] = useState('loading');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [logoUrl, setLogoUrl] = useState('');
  const [workingDays, setWorkingDays] = useState([]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({ resolver: zodResolver(schema) });

  useEffect(() => {
    organizationApi
      .get()
      .then(({ data }) => {
        const org = data.data;
        reset({
          name: org.name,
          email: org.email || '',
          phone: org.phone || '',
          address: org.address || '',
          country: org.country || '',
          timezone: org.timezone || '',
          officeStartTime: org.officeStartTime || '',
          officeEndTime: org.officeEndTime || '',
        });
        setLogoUrl(org.logoUrl || '');
        setWorkingDays(org.workingDays || []);
        setStatus('ready');
      })
      .catch(() => setStatus('error'));
  }, [reset]);

  const toggleDay = (day) => {
    setWorkingDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  };

  const onSubmit = async (values) => {
    setSaving(true);
    try {
      const { data } = await organizationApi.update({ ...values, workingDays });
      showToast('Organization settings saved');
      setLogoUrl(data.data.logoUrl || '');
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to save settings', 'error');
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
      showToast(err.response?.data?.message || 'Failed to upload logo', 'error');
    } finally {
      setUploading(false);
    }
  };

  if (status === 'loading') return <Loading label="Loading organization settings…" />;

  return (
    <div className="max-w-2xl">
      <h1 className="mb-1 text-xl font-semibold text-slate-900 dark:text-white">Organization Settings</h1>
      <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">
        This information is used across the HRMS — working hours, timezone, and branding.
      </p>

      <div className="mb-6 flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800">
          {logoUrl ? (
            <img src={logoUrl} alt="Organization logo" className="h-full w-full object-cover" />
          ) : (
            <span className="text-xs text-slate-400">No logo</span>
          )}
        </div>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleLogoChange}
          />
          <Button variant="secondary" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            <Upload size={15} /> {uploading ? 'Uploading…' : 'Upload logo'}
          </Button>
          <p className="mt-1 text-xs text-slate-400">JPG, PNG or WEBP. Max 2MB.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900" noValidate>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Organization Name" error={errors.name?.message}>
            <input {...register('name')} className={inputClass} />
          </Field>
          <Field label="Email" error={errors.email?.message}>
            <input {...register('email')} className={inputClass} />
          </Field>
          <Field label="Phone">
            <input {...register('phone')} className={inputClass} />
          </Field>
          <Field label="Country">
            <input {...register('country')} className={inputClass} />
          </Field>
          <Field label="Timezone">
            <input {...register('timezone')} className={inputClass} placeholder="e.g. Asia/Kolkata" />
          </Field>
          <Field label="Address">
            <input {...register('address')} className={inputClass} />
          </Field>
          <Field label="Office Start Time">
            <input type="time" {...register('officeStartTime')} className={inputClass} />
          </Field>
          <Field label="Office End Time">
            <input type="time" {...register('officeEndTime')} className={inputClass} />
          </Field>
        </div>

        <div>
          <label className="mb-2 block text-xs font-medium text-slate-600 dark:text-slate-300">Working Days</label>
          <div className="flex flex-wrap gap-2">
            {WEEKDAYS.map((day) => (
              <button
                type="button"
                key={day}
                onClick={() => toggleDay(day)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  workingDays.includes(day)
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                }`}
              >
                {day}
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </form>
    </div>
  );
}

const inputClass =
  'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white';

function Field({ label, error, children }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
