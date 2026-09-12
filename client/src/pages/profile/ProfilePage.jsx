import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useDispatch, useSelector } from 'react-redux';
import { Upload, Save, KeyRound, ShieldCheck } from 'lucide-react';
import { selectCurrentUser, updateCurrentEmployee, setAccessToken } from '../../features/auth/authSlice';
import { profileApi } from '../../api/profileApi';
import { useToast } from '../../hooks/useToast';
import { useApiQuery } from '../../hooks/useApiQuery';
import { Avatar, Button, Input, FormField, Card, CardHeader, PageHeader, FormSkeleton, Alert, Badge } from '../../components/ui';
import PasswordStrength from '../../components/PasswordStrength';
import { passwordSchema } from '../../utils/validation';
import { getApiErrorMessage } from '../../utils/apiError';
import { fullName, roleLabel, todayInputValue } from '../../utils/format';
import SessionsCard from './SessionsCard';

const profileSchema = z.object({
  phone: z.string().trim().max(30).optional(),
  dob: z.string().optional(),
  addressLine1: z.string().trim().max(200).optional(),
  addressCity: z.string().trim().max(100).optional(),
  addressState: z.string().trim().max(100).optional(),
  addressCountry: z.string().trim().max(100).optional(),
  addressZip: z.string().trim().max(20).optional(),
});

const passwordFormSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, 'Please confirm your new password'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, { message: 'Passwords do not match', path: ['confirmPassword'] })
  .refine((data) => data.newPassword !== data.currentPassword, { message: 'New password must be different from the current one', path: ['newPassword'] });

export default function ProfilePage() {
  const user = useSelector(selectCurrentUser);
  const dispatch = useDispatch();
  const { showToast } = useToast();
  const fileInputRef = useRef(null);

  const [saving, setSaving] = useState(false);
  const [profileError, setProfileError] = useState(null);
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState(null);
  const [uploading, setUploading] = useState(false);

  const profile = useApiQuery((signal) => profileApi.get({ signal }), []);
  const employee = profile.data?.employee;

  const profileForm = useForm({ resolver: zodResolver(profileSchema) });
  const passwordForm = useForm({ resolver: zodResolver(passwordFormSchema) });
  const newPassword = passwordForm.watch('newPassword', '');

  useEffect(() => {
    if (!employee) return;
    profileForm.reset({
      phone: employee.phone || '',
      dob: employee.dob ? employee.dob.slice(0, 10) : '',
      addressLine1: employee.address?.line1 || '',
      addressCity: employee.address?.city || '',
      addressState: employee.address?.state || '',
      addressCountry: employee.address?.country || '',
      addressZip: employee.address?.zip || '',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employee]);

  const onSaveProfile = async (values) => {
    setSaving(true);
    setProfileError(null);
    try {
      const { data } = await profileApi.update({
        phone: values.phone || '',
        dob: values.dob || '',
        address: {
          line1: values.addressLine1 || '',
          city: values.addressCity || '',
          state: values.addressState || '',
          country: values.addressCountry || '',
          zip: values.addressZip || '',
        },
      });
      profile.setData((prev) => ({ ...prev, employee: data.data }));
      dispatch(updateCurrentEmployee(data.data));
      profileForm.reset(values);
      showToast('Profile updated');
    } catch (err) {
      setProfileError(getApiErrorMessage(err, 'Unable to update your profile.'));
    } finally {
      setSaving(false);
    }
  };

  const onChangePassword = async (values) => {
    setChangingPassword(true);
    setPasswordError(null);
    try {
      const { data } = await profileApi.changePassword({ currentPassword: values.currentPassword, newPassword: values.newPassword });
      // The server rotated this browser's session (every other one was
      // revoked); adopt the new access token so we stay signed in here.
      if (data.data?.accessToken) dispatch(setAccessToken(data.data.accessToken));
      showToast({ title: 'Password changed', message: 'Other devices have been signed out.' });
      passwordForm.reset({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setPasswordError(getApiErrorMessage(err, 'Unable to change your password.'));
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
      profile.setData((prev) => ({ ...prev, employee: data.data }));
      dispatch(updateCurrentEmployee(data.data));
      showToast('Profile photo updated');
    } catch (err) {
      showToast(getApiErrorMessage(err, 'Unable to upload photo.'), 'error');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  if (profile.status === 'loading') {
    return (
      <div className="max-w-3xl">
        <PageHeader title="My Profile" />
        <FormSkeleton />
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-5">
      <PageHeader title="My Profile" description="Your personal information and account security." />

      <Card>
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
          <Avatar src={employee?.profileImageUrl} name={employee ? fullName(employee) : user?.email} size={72} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-lg font-semibold text-slate-900 dark:text-white">{employee ? fullName(employee) : user?.email}</p>
              <Badge tone="primary">{roleLabel(user?.role)}</Badge>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">{user?.email}</p>
            {employee && (
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                <span className="font-mono">{employee.employeeId}</span> · {employee.designation?.name || '—'} · {employee.department?.name || '—'}
              </p>
            )}
          </div>
          {employee && (
            <div>
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleAvatarChange} />
              <Button variant="secondary" icon={Upload} onClick={() => fileInputRef.current?.click()} loading={uploading}>
                Change photo
              </Button>
            </div>
          )}
        </div>
      </Card>

      {employee ? (
        <form onSubmit={profileForm.handleSubmit(onSaveProfile)} noValidate>
          <Card>
            <CardHeader title="Personal information" description="Job details like department, designation and manager are managed by HR." />
            <div className="space-y-4 p-5">
              {profileError && <Alert tone="danger">{profileError}</Alert>}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField label="Phone" error={profileForm.formState.errors.phone?.message}>
                  <Input type="tel" autoComplete="tel" {...profileForm.register('phone')} />
                </FormField>
                <FormField label="Date of birth" error={profileForm.formState.errors.dob?.message}>
                  <Input type="date" max={todayInputValue()} {...profileForm.register('dob')} />
                </FormField>
                <FormField label="Address line 1" className="sm:col-span-2">
                  <Input autoComplete="address-line1" {...profileForm.register('addressLine1')} />
                </FormField>
                <FormField label="City">
                  <Input autoComplete="address-level2" {...profileForm.register('addressCity')} />
                </FormField>
                <FormField label="State">
                  <Input autoComplete="address-level1" {...profileForm.register('addressState')} />
                </FormField>
                <FormField label="Country">
                  <Input autoComplete="country-name" {...profileForm.register('addressCountry')} />
                </FormField>
                <FormField label="ZIP / Postal code">
                  <Input autoComplete="postal-code" {...profileForm.register('addressZip')} />
                </FormField>
              </div>
              <div className="flex justify-end">
                <Button type="submit" icon={Save} loading={saving} disabled={!profileForm.formState.isDirty}>
                  Save changes
                </Button>
              </div>
            </div>
          </Card>
        </form>
      ) : (
        <Alert tone="info" title="No employee profile linked">
          This account is an administrator login without an employee record, so there are no personal details to edit here.
        </Alert>
      )}

      <form onSubmit={passwordForm.handleSubmit(onChangePassword)} noValidate>
        <Card>
          <CardHeader title="Change password" description="Use at least 8 characters with a letter and a number. Changing it signs out your other devices." />
          <div className="space-y-4 p-5">
            {passwordError && <Alert tone="danger">{passwordError}</Alert>}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <FormField label="Current password" required error={passwordForm.formState.errors.currentPassword?.message}>
                <Input type="password" autoComplete="current-password" {...passwordForm.register('currentPassword')} />
              </FormField>
              <FormField label="New password" required error={passwordForm.formState.errors.newPassword?.message}>
                <Input type="password" autoComplete="new-password" {...passwordForm.register('newPassword')} />
              </FormField>
              <FormField label="Confirm new password" required error={passwordForm.formState.errors.confirmPassword?.message}>
                <Input type="password" autoComplete="new-password" {...passwordForm.register('confirmPassword')} />
              </FormField>
            </div>
            <PasswordStrength value={newPassword} />
            <div className="flex items-center justify-between gap-3">
              <p className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                <ShieldCheck size={14} aria-hidden="true" /> Passwords are hashed and never stored in plain text.
              </p>
              <Button type="submit" icon={KeyRound} loading={changingPassword}>
                Change password
              </Button>
            </div>
          </div>
        </Card>
      </form>

      <SessionsCard />
    </div>
  );
}
