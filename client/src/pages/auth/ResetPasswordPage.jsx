import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { authApi } from '../../api/authApi';

const schema = z.object({
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string().min(6, 'Please confirm your password'),
}).refine((data) => data.password === data.confirmPassword, {
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
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema) });

  const onSubmit = async ({ password }) => {
    setServerError(null);
    try {
      await authApi.resetPassword(token, password);
      setSuccess(true);
      setTimeout(() => navigate('/login', { replace: true }), 2000);
    } catch (err) {
      setServerError(err.response?.data?.message || 'Unable to reset password. Please try again.');
    }
  };

  if (!token) {
    return (
      <div>
        <h1 className="mb-1 text-lg font-semibold text-slate-900 dark:text-white">Invalid link</h1>
        <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">
          This password reset link is missing its token. Please request a new one.
        </p>
        <Link to="/forgot-password" className="text-sm text-indigo-600 hover:underline dark:text-indigo-400">
          Request a new link
        </Link>
      </div>
    );
  }

  if (success) {
    return (
      <div>
        <h1 className="mb-1 text-lg font-semibold text-slate-900 dark:text-white">Password reset</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Your password has been updated. Redirecting you to sign in…
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-1 text-lg font-semibold text-slate-900 dark:text-white">Set a new password</h1>
      <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">
        Choose a new password for your account.
      </p>

      {serverError && (
        <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">
          {serverError}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
        <div>
          <input
            type="password"
            placeholder="New password"
            {...register('password')}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
          {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>}
        </div>

        <div>
          <input
            type="password"
            placeholder="Confirm new password"
            {...register('confirmPassword')}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
          {errors.confirmPassword && (
            <p className="mt-1 text-xs text-red-600">{errors.confirmPassword.message}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-60"
        >
          {isSubmitting ? 'Resetting…' : 'Reset password'}
        </button>
      </form>
    </div>
  );
}
