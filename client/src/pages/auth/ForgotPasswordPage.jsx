import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link } from 'react-router-dom';
import { ArrowLeft, MailCheck, AlertCircle, Loader2 } from 'lucide-react';
import { authApi } from '../../api/authApi';
import { getApiErrorMessage } from '../../utils/apiError';

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
      setSubmitted(true);
    } catch (err) {
      setServerError(getApiErrorMessage(err));
    }
  };

  if (submitted) {
    return (
      <div className="text-center flex flex-col items-center">
        <div className="neu-badge mb-4">
          <MailCheck size={18} className="neu-badge-icon" />
          <span>Email Sent</span>
        </div>
        <h1 className="neu-heading text-2xl">Check your email</h1>
        <p className="neu-subtitle">
          If an account with that email exists, we&apos;ve sent a password reset link. It expires in one hour.
        </p>
        <Link to="/login" className="neu-button mt-2">
          <ArrowLeft size={16} /> Back to Sign In
        </Link>
      </div>
    );
  }

  return (
    <div className="text-center flex flex-col items-center">
      <h1 className="neu-heading text-2xl">Forgot password</h1>
      <p className="neu-subtitle">Enter your work email and we&apos;ll send you a reset link.</p>

      {serverError && (
        <div className="neu-alert danger text-left">
          <AlertCircle size={18} className="shrink-0" />
          <span>{serverError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="w-full space-y-4" noValidate>
        <div className="neu-input-group text-left">
          <input
            type="email"
            placeholder="you@company.com"
            autoComplete="email"
            autoFocus
            className={`neu-input ${errors.email ? 'error' : ''}`}
            {...register('email')}
          />
          {errors.email && (
            <div className="neu-input-error-msg">{errors.email.message}</div>
          )}
        </div>

        <button type="submit" disabled={isSubmitting} className="neu-button w-full">
          {isSubmitting ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              <span>Sending…</span>
            </>
          ) : (
            'Send reset link'
          )}
        </button>

        <div className="pt-2">
          <Link to="/login" className="neu-link inline-flex items-center gap-1.5">
            <ArrowLeft size={14} /> Back to Sign In
          </Link>
        </div>
      </form>
    </div>
  );
}
