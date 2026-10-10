import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, AlertCircle, Loader2, ArrowLeft } from 'lucide-react';
import { authApi } from '../../api/authApi';
import { getApiErrorMessage } from '../../utils/apiError';
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
      <div className="text-center flex flex-col items-center">
        <h1 className="neu-heading text-2xl">Invalid link</h1>
        <p className="neu-subtitle">This password reset link is missing its token. Request a new one to continue.</p>
        <Link to="/forgot-password" className="neu-button">
          Request a new reset link
        </Link>
      </div>
    );
  }

  if (success) {
    return (
      <div className="text-center flex flex-col items-center">
        <div className="neu-badge mb-4">
          <CheckCircle2 size={18} className="neu-badge-icon text-emerald-600" />
          <span>Password updated</span>
        </div>
        <h1 className="neu-heading text-2xl">Password updated</h1>
        <p className="neu-subtitle">You&apos;ll be redirected to sign in shortly.</p>
        <Link to="/login" className="neu-button mt-2">
          <ArrowLeft size={16} /> Go to sign in now
        </Link>
      </div>
    );
  }

  return (
    <div className="text-center flex flex-col items-center">
      <h1 className="neu-heading text-2xl">Set a new password</h1>
      <p className="neu-subtitle">Choose a strong password you don&apos;t use anywhere else.</p>

      {serverError && (
        <div className="neu-alert danger text-left">
          <AlertCircle size={18} className="shrink-0" />
          <span>{serverError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="w-full space-y-4" noValidate>
        <div className="neu-input-group text-left">
          <input
            type="password"
            placeholder="New password"
            autoComplete="new-password"
            autoFocus
            className={`neu-input ${errors.password ? 'error' : ''}`}
            {...register('password')}
          />
          {errors.password && (
            <div className="neu-input-error-msg">{errors.password.message}</div>
          )}
        </div>

        <PasswordStrength value={password} />

        <div className="neu-input-group text-left">
          <input
            type="password"
            placeholder="Confirm password"
            autoComplete="new-password"
            className={`neu-input ${errors.confirmPassword ? 'error' : ''}`}
            {...register('confirmPassword')}
          />
          {errors.confirmPassword && (
            <div className="neu-input-error-msg">{errors.confirmPassword.message}</div>
          )}
        </div>

        <button type="submit" disabled={isSubmitting} className="neu-button w-full">
          {isSubmitting ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              <span>Updating…</span>
            </>
          ) : (
            'Update password'
          )}
        </button>
      </form>
    </div>
  );
}
