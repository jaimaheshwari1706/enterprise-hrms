import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link } from 'react-router-dom';
import { authApi } from '../../api/authApi';

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
});

export default function ForgotPasswordPage() {
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema) });

  const onSubmit = async ({ email }) => {
    setServerError(null);
    try {
      await authApi.forgotPassword(email);
      // We always show the same success message regardless of whether the
      // email exists, matching the backend's anti-enumeration behavior.
      setSubmitted(true);
    } catch (err) {
      setServerError(err.response?.data?.message || 'Something went wrong. Please try again.');
    }
  };

  if (submitted) {
    return (
      <div>
        <h1 className="mb-1 text-lg font-semibold text-slate-900 dark:text-white">Check your email</h1>
        <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">
          If an account with that email exists, we&apos;ve sent a password reset link.
        </p>
        <Link to="/login" className="text-sm text-indigo-600 hover:underline dark:text-indigo-400">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-1 text-lg font-semibold text-slate-900 dark:text-white">Forgot password</h1>
      <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">
        Enter your email and we&apos;ll send you a reset link.
      </p>

      {serverError && (
        <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">
          {serverError}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
        <div>
          <input
            type="email"
            placeholder="Email"
            {...register('email')}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
          {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-60"
        >
          {isSubmitting ? 'Sending…' : 'Send reset link'}
        </button>

        <Link to="/login" className="block text-center text-xs text-indigo-600 hover:underline dark:text-indigo-400">
          Back to sign in
        </Link>
      </form>
    </div>
  );
}
