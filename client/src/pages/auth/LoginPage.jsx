import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { loginUser, selectAuthStatus } from '../../features/auth/authSlice';

const loginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export default function LoginPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const status = useSelector(selectAuthStatus);
  const serverError = useSelector((state) => state.auth.error);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (values) => {
    const result = await dispatch(loginUser(values));
    if (loginUser.fulfilled.match(result)) {
      const redirectTo = location.state?.from?.pathname || '/dashboard';
      navigate(redirectTo, { replace: true });
    }
  };

  const isSubmitting = status === 'loading';

  return (
    <div>
      <h1 className="mb-1 text-lg font-semibold text-slate-900 dark:text-white">Sign in</h1>
      <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">
        Welcome back — enter your credentials to continue.
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
            autoComplete="email"
            {...register('email')}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
          {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
        </div>

        <div>
          <input
            type="password"
            placeholder="Password"
            autoComplete="current-password"
            {...register('password')}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
          {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>}
        </div>

        <div className="flex justify-end">
          <Link to="/forgot-password" className="text-xs text-indigo-600 hover:underline dark:text-indigo-400">
            Forgot password?
          </Link>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-60"
        >
          {isSubmitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
