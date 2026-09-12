import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link } from 'react-router-dom';
import { ArrowLeft, MailCheck } from 'lucide-react';
import { authApi } from '../../api/authApi';
import { getApiErrorMessage } from '../../utils/apiError';
import { Button, Input, FormField, Alert } from '../../components/ui';

const schema = z.object({
  email: z.string().trim().email('Enter a valid email address'),
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
      setServerError(getApiErrorMessage(err));
    }
  };

  if (submitted) {
    return (
      <div>
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300">
          <MailCheck size={22} aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">Check your email</h1>
        <p className="mt-1 mb-6 text-sm text-slate-500 dark:text-slate-400">
          If an account with that email exists, we&apos;ve sent a password reset link. It expires in one hour.
        </p>
        <Link to="/login" className="inline-flex items-center gap-1 text-sm font-medium text-primary-600 hover:underline dark:text-primary-400">
          <ArrowLeft size={14} aria-hidden="true" /> Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">Forgot password</h1>
      <p className="mt-1 mb-6 text-sm text-slate-500 dark:text-slate-400">Enter your work email and we&apos;ll send you a reset link.</p>

      {serverError && (
        <Alert tone="danger" className="mb-4">
          {serverError}
        </Alert>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <FormField label="Email" required error={errors.email?.message}>
          <Input type="email" placeholder="you@company.com" autoComplete="email" autoFocus {...register('email')} />
        </FormField>

        <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
          {isSubmitting ? 'Sending…' : 'Send reset link'}
        </Button>

        <Link to="/login" className="flex items-center justify-center gap-1 text-xs font-medium text-primary-600 hover:underline dark:text-primary-400">
          <ArrowLeft size={13} aria-hidden="true" /> Back to sign in
        </Link>
      </form>
    </div>
  );
}
