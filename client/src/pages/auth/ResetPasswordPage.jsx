import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { authApi } from '../../api/authApi';
import { getApiErrorMessage } from '../../utils/apiError';
import { Button, Input, FormField, Alert } from '../../components/ui';
import PasswordStrength from '../../components/PasswordStrength';
import { passwordSchema } from '../../utils/validation';

const schema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const [serverError, setServerError] = useState(null);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema) });

  const password = watch('password', '');

  const onSubmit = async ({ password: newPassword }) => {
    setServerError(null);
    try {
      await authApi.resetPassword(token, newPassword);
      setSuccess(true);
      setTimeout(() => navigate('/login', { replace: true }), 2500);
    } catch (err) {
      setServerError(getApiErrorMessage(err, 'Unable to reset password. Please try again.'));
    }
  };

  if (!token) {
    return (
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">Invalid link</h1>
        <p className="mt-1 mb-6 text-sm text-slate-500 dark:text-slate-400">This password reset link is missing its token. Request a new one to continue.</p>
        <Link to="/forgot-password" className="text-sm font-medium text-primary-600 hover:underline dark:text-primary-400">
          Request a new reset link
        </Link>
      </div>
    );
  }

  if (success) {
    return (
      <div>
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300">
          <CheckCircle2 size={22} aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">Password updated</h1>
        <p className="mt-1 mb-6 text-sm text-slate-500 dark:text-slate-400">You&apos;ll be redirected to sign in shortly.</p>
        <Link to="/login" className="text-sm font-medium text-primary-600 hover:underline dark:text-primary-400">
          Go to sign in now
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">Set a new password</h1>
      <p className="mt-1 mb-6 text-sm text-slate-500 dark:text-slate-400">Choose a strong password you don&apos;t use anywhere else.</p>

      {serverError && (
        <Alert tone="danger" className="mb-4">
          {serverError}
        </Alert>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <FormField label="New password" required error={errors.password?.message}>
          <Input type="password" autoComplete="new-password" autoFocus {...register('password')} />
        </FormField>
        <PasswordStrength value={password} />
        <FormField label="Confirm password" required error={errors.confirmPassword?.message}>
          <Input type="password" autoComplete="new-password" {...register('confirmPassword')} />
        </FormField>

        <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
          {isSubmitting ? 'Updating…' : 'Update password'}
        </Button>
      </form>
    </div>
  );
}
