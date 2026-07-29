import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useSelector } from 'react-redux';
import { Upload } from 'lucide-react';
import { selectCurrentUser } from '../../features/auth/authSlice';
import { profileApi } from '../../api/profileApi';
import { useToast } from '../../components/ToastProvider';
import Avatar from '../../components/Avatar';
import Button from '../../components/Button';
import { Loading } from '../../components/StateViews';

const profileSchema = z.object({
  phone: z.string().optional(),
  dob: z.string().optional(),
  addressLine1: z.string().optional(),
  addressCity: z.string().optional(),
  addressState: z.string().optional(),
  addressCountry: z.string().optional(),
  addressZip: z.string().optional(),
});

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(6, 'New password must be at least 6 characters'),
    confirmPassword: z.string().min(1, 'Please confirm your new password'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

const inputClass =
  'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white';

export default function ProfilePage() {
  const user = useSelector(selectCurrentUser);
  const { showToast } = useToast();
  const fileInputRef = useRef(null);

  const [status, setStatus] = useState('loading');
  const [employee, setEmployee] = useState(null);
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [uploading, setUploading] = useState(false);

  const profileForm = useForm({ resolver: zodResolver(profileSchema) });
  const passwordForm = useForm({ resolver: zodResolver(passwordSchema) });

  useEffect(() => {
    profileApi
      .get()
      .then(({ data }) => {
        const emp = data.data.employee;
        setEmployee(emp);
        if (emp) {
          profileForm.reset({
            phone: emp.phone || '',
            dob: emp.dob ? emp.dob.slice(0, 10) : '',
            addressLine1: emp.address?.line1 || '',
            addressCity: emp.address?.city || '',
            addressState: emp.address?.state || '',
            addressCountry: emp.address?.country || '',
            addressZip: emp.address?.zip || '',
          });
        }
        setStatus('ready');
      })
      .catch(() => setStatus('error'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSaveProfile = async (values) => {
    setSaving(true);
    try {
      const { data } = await profileApi.update({
        phone: values.phone,
        dob: values.dob || undefined,
        address: {
          line1: values.addressLine1,
          city: values.addressCity,
          state: values.addressState,
          country: values.addressCountry,
          zip: values.addressZip,
        },
      });
      setEmployee(data.data);
      showToast('Profile updated successfully');
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to update profile', 'error');
    } finally {
      setSaving(false);
    }
  };

  const onChangePassword = async (values) => {
    setChangingPassword(true);
    try {
      await profileApi.changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      showToast('Password changed successfully');
      passwordForm.reset({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to change password', 'error');
    } finally {
      setChangingPassword(false);
    }
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { data } = await profileApi.uploadAvatar(file);
      setEmployee(data.data);
      showToast('Profile photo updated');
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to upload photo', 'error');
    } finally {
      setUploading(false);
    }
  };

  if (status === 'loading') return <Loading label="Loading profile…" />;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="mb-1 text-xl font-semibold text-slate-900 dark:text-white">My Profile</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Manage your personal information and account security.</p>
      </div>

      <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <Avatar src={employee?.profileImageUrl} name={employee ? `${employee.firstName} ${employee.lastName}` : user?.email} size={64} />
        <div>
          <p className="font-medium text-slate-900 dark:text-white">
            {employee ? `${employee.firstName} ${employee.lastName}` : user?.email}
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400">{user?.email} · {user?.role}</p>
          {employee && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleAvatarChange}
              />
              <Button variant="secondary" className="mt-2" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                <Upload size={14} /> {uploading ? 'Uploading…' : 'Change photo'}
              </Button>
            </>
          )}
        </div>
      </div>

      {employee ? (
        <form
          onSubmit={profileForm.handleSubmit(onSaveProfile)}
          className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
          noValidate
        >
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Personal Information</h2>
          <p className="text-xs text-slate-400">
            Job details like department, designation, and manager are managed by HR.
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Phone</label>
              <input {...profileForm.register('phone')} className={inputClass} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Date of Birth</label>
              <input type="date" {...profileForm.register('dob')} className={inputClass} />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Address Line 1</label>
              <input {...profileForm.register('addressLine1')} className={inputClass} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">City</label>
              <input {...profileForm.register('addressCity')} className={inputClass} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">State</label>
              <input {...profileForm.register('addressState')} className={inputClass} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Country</label>
              <input {...profileForm.register('addressCountry')} className={inputClass} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">ZIP / Postal Code</label>
              <input {...profileForm.register('addressZip')} className={inputClass} />
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        </form>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          No employee profile is linked to this account.
        </div>
      )}

      <form
        onSubmit={passwordForm.handleSubmit(onChangePassword)}
        className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
        noValidate
      >
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Change Password</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Current Password</label>
            <input type="password" {...passwordForm.register('currentPassword')} className={inputClass} />
            {passwordForm.formState.errors.currentPassword && (
              <p className="mt-1 text-xs text-red-600">{passwordForm.formState.errors.currentPassword.message}</p>
            )}
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">New Password</label>
            <input type="password" {...passwordForm.register('newPassword')} className={inputClass} />
            {passwordForm.formState.errors.newPassword && (
              <p className="mt-1 text-xs text-red-600">{passwordForm.formState.errors.newPassword.message}</p>
            )}
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Confirm New Password</label>
            <input type="password" {...passwordForm.register('confirmPassword')} className={inputClass} />
            {passwordForm.formState.errors.confirmPassword && (
              <p className="mt-1 text-xs text-red-600">{passwordForm.formState.errors.confirmPassword.message}</p>
            )}
          </div>
        </div>
        <div className="flex justify-end">
          <Button type="submit" disabled={changingPassword}>
            {changingPassword ? 'Updating…' : 'Change password'}
          </Button>
        </div>
      </form>
    </div>
  );
}
