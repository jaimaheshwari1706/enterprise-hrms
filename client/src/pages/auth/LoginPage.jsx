import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  ShieldCheck,
  Users,
  CalendarDays,
  Wallet,
  Sun,
  Moon,
} from 'lucide-react';
import {
  loginUser,
  selectAuthStatus,
  selectSessionExpired,
  clearAuthError,
} from '../../features/auth/authSlice';
import { toggleTheme } from '../../features/theme/themeSlice';
import { authApi } from '../../api/authApi';
import { getApiErrorMessage } from '../../utils/apiError';

const loginSchema = z.object({
  email: z.string().trim().email('Enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const signUpSchema = z.object({
  fullName: z.string().trim().min(2, 'Name must be at least 2 characters'),
  email: z.string().trim().email('Enter a valid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Za-z]/, 'Password must contain at least one letter')
    .regex(/\d/, 'Password must contain at least one number'),
});

export default function LoginPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();

  const status = useSelector(selectAuthStatus);
  const serverError = useSelector((state) => state.auth.error);
  const expired = useSelector(selectSessionExpired);
  const mode = useSelector((state) => state.theme.mode);

  const queryParams = new URLSearchParams(location.search);
  const initialSignUp =
    queryParams.get('mode') === 'signup' || queryParams.get('signup') === 'true';

  const [isSignUp, setIsSignUp] = useState(initialSignUp);
  const [showPassword, setShowPassword] = useState(false);
  const [showSignUpPassword, setShowSignUpPassword] = useState(false);
  const [forgotPasswordMode, setForgotPasswordMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSubmitting, setForgotSubmitting] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState(false);
  const [forgotError, setForgotError] = useState(null);
  const [signUpSuccessMsg, setSignUpSuccessMsg] = useState(null);
  const [signUpError, setSignUpError] = useState(null);

  // Sign In Form
  const {
    register: registerLogin,
    handleSubmit: handleSubmitLogin,
    setValue: setLoginValue,
    formState: { errors: loginErrors },
  } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  // Sign Up Form
  const {
    register: registerSignUp,
    handleSubmit: handleSubmitSignUp,
    reset: resetSignUp,
    formState: { errors: signUpErrors, isSubmitting: isSubmittingSignUp },
  } = useForm({
    resolver: zodResolver(signUpSchema),
    defaultValues: { fullName: '', email: '', password: '' },
  });

  // Redirect if already authenticated
  useEffect(() => {
    if (status === 'authenticated') {
      const redirectTo = location.state?.from?.pathname || '/dashboard';
      navigate(redirectTo, { replace: true });
    }
  }, [status, navigate, location.state]);

  // Clear errors on unmount
  useEffect(() => {
    return () => dispatch(clearAuthError());
  }, [dispatch]);

  const onLoginSubmit = async (values) => {
    const result = await dispatch(loginUser(values));
    if (loginUser.fulfilled.match(result)) {
      const redirectTo = location.state?.from?.pathname || '/dashboard';
      navigate(redirectTo, { replace: true });
    }
  };

  const onSignUpSubmit = async (values) => {
    setSignUpSuccessMsg(null);
    setSignUpError(null);
    try {
      const response = await authApi.register(values);
      const { accessToken } = response.data.data;
      if (accessToken) {
        const loginResult = await dispatch(
          loginUser({ email: values.email, password: values.password })
        );
        if (loginUser.fulfilled.match(loginResult)) {
          const redirectTo = location.state?.from?.pathname || '/dashboard';
          navigate(redirectTo, { replace: true });
          return;
        }
      }
      setSignUpSuccessMsg(`Account created for ${values.fullName}! Redirecting...`);
      resetSignUp();
    } catch (err) {
      const errorMsg = getApiErrorMessage(err);
      setSignUpError(errorMsg);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (!forgotEmail || !forgotEmail.includes('@')) {
      setForgotError('Please enter a valid work email.');
      return;
    }
    setForgotSubmitting(true);
    setForgotError(null);
    try {
      await authApi.forgotPassword(forgotEmail);
      setForgotSuccess(true);
    } catch (err) {
      setForgotError(getApiErrorMessage(err));
    } finally {
      setForgotSubmitting(false);
    }
  };

  const fillDemoCredentials = () => {
    setLoginValue('email', 'admin@hrms.local', { shouldValidate: true });
    setLoginValue('password', 'Admin@123', { shouldValidate: true });
    if (isSignUp) setIsSignUp(false);
    if (forgotPasswordMode) setForgotPasswordMode(false);
  };

  const isLoggingIn = status === 'loading';

  return (
    <div className="min-h-screen min-h-dvh flex flex-col lg:flex-row bg-[#f8faff] dark:bg-slate-950 font-sans selection:bg-indigo-500/20">
      {/* =========================================================================
          LEFT PANEL: Dark violet brand & feature showcase (Matches reference image)
          ========================================================================= */}
      <section className="relative hidden lg:flex lg:w-1/2 flex-col justify-between overflow-hidden bg-gradient-to-br from-[#120f38] via-[#1a164c] to-[#0f0c2d] p-10 xl:p-14 text-white shadow-2xl z-10">
        {/* Subtle radial ambient glows */}
        <div className="pointer-events-none absolute -top-24 -left-24 h-96 w-96 rounded-full bg-violet-600/20 blur-3xl" />
        <div className="pointer-events-none absolute bottom-12 right-0 h-96 w-96 rounded-full bg-indigo-500/15 blur-3xl" />

        {/* Brand Logo Header */}
        <div className="relative z-10 flex items-center gap-3">
          <img
            src="/logo.svg"
            alt="HRONE"
            className="h-10 w-10 shrink-0 rounded-xl shadow-md"
          />
          <div className="flex items-center text-[22px] font-black tracking-wider text-white select-none">
            <span>HR</span>
            <span className="relative inline-flex items-center justify-center px-[0.5px]">
              O
              <span className="absolute h-2 w-2 rounded-full bg-cyan-400 ring-2 ring-[#161340]" />
            </span>
            <span>NE</span>
          </div>
        </div>

        {/* Hero Copy & Feature Cards */}
        <div className="relative z-10 my-auto py-12 max-w-xl">
          <h1 className="text-4xl xl:text-[46px] font-extrabold tracking-tight leading-[1.14] text-white">
            People operations,
            <br />
            in one place.
          </h1>

          <p className="mt-4 text-slate-300 text-[15px] sm:text-base leading-relaxed">
            Employees, attendance, leave, payroll and approvals, all working together.
          </p>

          <div className="mt-9 space-y-3.5">
            {/* Feature 1 */}
            <div className="group flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-md transition-all duration-200 hover:bg-white/[0.07] hover:border-white/20">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] text-slate-200 transition-colors group-hover:text-white">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-[15px] font-semibold text-white">People, organized</h2>
                <p className="text-xs text-slate-300/80 mt-0.5">
                  Employees, departments and roles in one place.
                </p>
              </div>
            </div>

            {/* Feature 2 */}
            <div className="group flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-md transition-all duration-200 hover:bg-white/[0.07] hover:border-white/20">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] text-slate-200 transition-colors group-hover:text-white">
                <CalendarDays className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-[15px] font-semibold text-white">Time & leave</h2>
                <p className="text-xs text-slate-300/80 mt-0.5">
                  Attendance and approvals without the back-and-forth.
                </p>
              </div>
            </div>

            {/* Feature 3 */}
            <div className="group flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-md transition-all duration-200 hover:bg-white/[0.07] hover:border-white/20">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] text-slate-200 transition-colors group-hover:text-white">
                <Wallet className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-[15px] font-semibold text-white">Payroll you can trust</h2>
                <p className="text-xs text-slate-300/80 mt-0.5">
                  Payslips generated, tracked and paid on time.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Credit */}
        <div className="relative z-10 pt-4">
          <p className="text-xs text-slate-400 font-medium tracking-wide">
            © 2026 HRONE · by Jai
          </p>
        </div>
      </section>

      {/* =========================================================================
          RIGHT PANEL: Clean light background with floating Login Card
          ========================================================================= */}
      <main className="relative flex flex-1 flex-col justify-between overflow-y-auto px-4 py-6 sm:px-8 sm:py-8 lg:p-12">
        {/* Soft atmospheric gradient in background */}
        <div className="pointer-events-none absolute top-1/4 right-1/4 h-80 w-80 rounded-full bg-indigo-100/60 dark:bg-indigo-950/20 blur-3xl" />

        {/* Top bar with Mobile Brand + Dark/Light Mode toggle */}
        <div className="relative z-10 flex items-center justify-between">
          {/* Mobile Logo (Visible on mobile/tablet screens only) */}
          <div className="flex items-center gap-2.5 lg:hidden">
            <img src="/logo.svg" alt="HRONE" className="h-8 w-8 rounded-lg shadow-xs" />
            <span className="text-lg font-black tracking-wider text-slate-900 dark:text-white">
              HR
              <span className="relative inline-flex items-center justify-center px-[0.5px]">
                O
                <span className="absolute h-1.5 w-1.5 rounded-full bg-cyan-400 ring-2 ring-white dark:ring-slate-900" />
              </span>
              NE
            </span>
          </div>

          <div className="ml-auto">
            <button
              type="button"
              onClick={() => dispatch(toggleTheme())}
              aria-label={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white/90 px-3.5 py-1.5 text-xs font-medium text-slate-600 shadow-xs backdrop-blur-xs transition hover:border-slate-300 hover:bg-white hover:text-slate-900 dark:border-slate-800 dark:bg-slate-900/90 dark:text-slate-300 dark:hover:border-slate-700 dark:hover:text-white"
            >
              {mode === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
              <span>Toggle dark / light</span>
            </button>
          </div>
        </div>

        {/* Centered Floating Card */}
        <div className="relative z-10 my-auto flex flex-col items-center justify-center py-6">
          <div className="w-full max-w-[430px] rounded-[28px] border border-slate-100 bg-white p-7 sm:p-9 shadow-[0_20px_50px_-10px_rgba(15,23,42,0.07),0_1px_3px_rgba(15,23,42,0.04)] dark:border-slate-800/80 dark:bg-slate-900 dark:shadow-[0_25px_60px_-15px_rgba(0,0,0,0.6)]">
            {/* ----------------------------------------------------
                MODE 1: FORGOT PASSWORD
               ---------------------------------------------------- */}
            {forgotPasswordMode ? (
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                  Reset password
                </h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Enter your work email and we&apos;ll send you a recovery link.
                </p>

                {forgotSuccess ? (
                  <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 text-xs font-medium text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300">
                    <div className="flex items-center gap-2.5">
                      <CheckCircle2 size={18} className="shrink-0 text-emerald-600" />
                      <span>Reset link sent! Please check your inbox.</span>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleForgotPassword} className="mt-5 space-y-4" noValidate>
                    {forgotError && (
                      <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50/80 p-3 text-xs font-medium text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
                        <AlertCircle size={16} className="shrink-0 text-rose-600" />
                        <span>{forgotError}</span>
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Email
                      </label>
                      <div className="relative mt-1.5">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                          <Mail size={18} />
                        </div>
                        <input
                          type="email"
                          placeholder="you@company.com"
                          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20 dark:border-slate-700 dark:bg-slate-800/90 dark:text-white dark:placeholder:text-slate-500"
                          value={forgotEmail}
                          onChange={(e) => setForgotEmail(e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={forgotSubmitting}
                      className="mt-2 flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-[#6e3bfa] to-[#8742ff] py-3 px-4 text-sm font-semibold text-white shadow-md shadow-violet-500/25 transition-all hover:from-[#6230e8] hover:to-[#7834eb] focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-60"
                    >
                      {forgotSubmitting ? (
                        <>
                          <Loader2 size={16} className="mr-2 animate-spin" />
                          <span>Sending link...</span>
                        </>
                      ) : (
                        'Send Reset Link'
                      )}
                    </button>
                  </form>
                )}

                <div className="mt-5 pt-3 border-t border-slate-100 text-center dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setForgotPasswordMode(false);
                      setForgotSuccess(false);
                      setForgotError(null);
                    }}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition"
                  >
                    <ArrowLeft size={14} /> Back to Sign In
                  </button>
                </div>
              </div>
            ) : isSignUp ? (
              /* ----------------------------------------------------
                 MODE 2: SIGN UP
                 ---------------------------------------------------- */
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                  Create account
                </h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Join your HRONE organization today.
                </p>

                {signUpSuccessMsg && (
                  <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/80 p-3 text-xs font-medium text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300">
                    <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
                    <span>{signUpSuccessMsg}</span>
                  </div>
                )}

                {signUpError && (
                  <div className="mt-4 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50/80 p-3 text-xs font-medium text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
                    <AlertCircle size={16} className="shrink-0 text-rose-600" />
                    <span>{signUpError}</span>
                  </div>
                )}

                <form onSubmit={handleSubmitSignUp(onSignUpSubmit)} className="mt-5 space-y-4" noValidate>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Full Name
                    </label>
                    <div className="relative mt-1.5">
                      <input
                        type="text"
                        placeholder="Vaishali Sharma"
                        className={`w-full rounded-xl border bg-white py-2.5 px-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 dark:bg-slate-800/90 dark:text-white dark:placeholder:text-slate-500 ${signUpErrors.fullName
                            ? 'border-red-500 focus:ring-red-500/20'
                            : 'border-slate-200 focus:border-violet-500 focus:ring-violet-500/20 dark:border-slate-700'
                          }`}
                        {...registerSignUp('fullName')}
                      />
                    </div>
                    {signUpErrors.fullName && (
                      <p className="mt-1 text-xs text-red-500 font-medium">
                        {signUpErrors.fullName.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Work Email
                    </label>
                    <div className="relative mt-1.5">
                      <input
                        type="email"
                        placeholder="you@company.com"
                        className={`w-full rounded-xl border bg-white py-2.5 px-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 dark:bg-slate-800/90 dark:text-white dark:placeholder:text-slate-500 ${signUpErrors.email
                            ? 'border-red-500 focus:ring-red-500/20'
                            : 'border-slate-200 focus:border-violet-500 focus:ring-violet-500/20 dark:border-slate-700'
                          }`}
                        {...registerSignUp('email')}
                      />
                    </div>
                    {signUpErrors.email && (
                      <p className="mt-1 text-xs text-red-500 font-medium">
                        {signUpErrors.email.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Password
                    </label>
                    <div className="relative mt-1.5">
                      <input
                        type={showSignUpPassword ? 'text' : 'password'}
                        placeholder="Create strong password"
                        className={`w-full rounded-xl border bg-white py-2.5 pl-3.5 pr-10 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 dark:bg-slate-800/90 dark:text-white dark:placeholder:text-slate-500 ${signUpErrors.password
                            ? 'border-red-500 focus:ring-red-500/20'
                            : 'border-slate-200 focus:border-violet-500 focus:ring-violet-500/20 dark:border-slate-700'
                          }`}
                        {...registerSignUp('password')}
                      />
                      <button
                        type="button"
                        onClick={() => setShowSignUpPassword(!showSignUpPassword)}
                        aria-label={showSignUpPassword ? 'Hide password' : 'Show password'}
                        className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition"
                      >
                        {showSignUpPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                    {signUpErrors.password && (
                      <p className="mt-1 text-xs text-red-500 font-medium">
                        {signUpErrors.password.message}
                      </p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmittingSignUp}
                    className="mt-2 flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-[#6e3bfa] to-[#8742ff] py-3 px-4 text-sm font-semibold text-white shadow-md shadow-violet-500/25 transition-all hover:from-[#6230e8] hover:to-[#7834eb] focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-60"
                  >
                    {isSubmittingSignUp ? (
                      <>
                        <Loader2 size={16} className="mr-2 animate-spin" />
                        <span>Creating account...</span>
                      </>
                    ) : (
                      'Sign Up'
                    )}
                  </button>
                </form>

                <div className="mt-5 pt-3 border-t border-slate-100 text-center dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsSignUp(false)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition"
                  >
                    <ArrowLeft size={14} /> Back to Sign In
                  </button>
                </div>
              </div>
            ) : (
              /* ----------------------------------------------------
                 MODE 3: SIGN IN (Default - Pixel-perfect to Image 1)
                 ---------------------------------------------------- */
              <div>
                <h2 className="text-2xl sm:text-[27px] font-bold tracking-tight text-slate-900 dark:text-white">
                  Welcome back
                </h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Sign in to your HRONE workspace.
                </p>

                {expired && !serverError && (
                  <div className="mt-4 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-xs font-medium text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
                    <AlertCircle size={16} className="shrink-0 text-amber-600" />
                    <span>Your session has expired. Please sign in again.</span>
                  </div>
                )}

                {serverError && (
                  <div className="mt-4 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50/80 p-3 text-xs font-medium text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
                    <AlertCircle size={16} className="shrink-0 text-rose-600" />
                    <span>{serverError}</span>
                  </div>
                )}

                <form
                  onSubmit={handleSubmitLogin(onLoginSubmit)}
                  className="mt-6 space-y-4"
                  noValidate
                >
                  {/* Email Field */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Email
                    </label>
                    <div className="relative mt-1.5">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400 dark:text-slate-500">
                        <Mail size={18} />
                      </div>
                      <input
                        type="email"
                        placeholder="you@company.com"
                        autoComplete="email"
                        className={`w-full rounded-xl border bg-white py-2.5 pl-10 pr-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 dark:bg-slate-800/90 dark:text-white dark:placeholder:text-slate-500 transition-all ${loginErrors.email
                            ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
                            : 'border-slate-200 focus:border-violet-500 focus:ring-violet-500/20 dark:border-slate-700'
                          }`}
                        {...registerLogin('email')}
                      />
                    </div>
                    {loginErrors.email && (
                      <p className="mt-1 text-xs text-red-500 font-medium">
                        {loginErrors.email.message}
                      </p>
                    )}
                  </div>

                  {/* Password Field */}
                  <div>
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Password
                      </label>
                      <button
                        type="button"
                        onClick={() => setForgotPasswordMode(true)}
                        className="text-xs font-medium text-violet-600 hover:text-violet-700 dark:text-violet-400 transition"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <div className="relative mt-1.5">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400 dark:text-slate-500">
                        <Lock size={18} />
                      </div>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Enter your password"
                        autoComplete="current-password"
                        className={`w-full rounded-xl border bg-white py-2.5 pl-10 pr-10 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 dark:bg-slate-800/90 dark:text-white dark:placeholder:text-slate-500 transition-all ${loginErrors.password
                            ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
                            : 'border-slate-200 focus:border-violet-500 focus:ring-violet-500/20 dark:border-slate-700'
                          }`}
                        {...registerLogin('password')}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition"
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                    {loginErrors.password && (
                      <p className="mt-1 text-xs text-red-500 font-medium">
                        {loginErrors.password.message}
                      </p>
                    )}
                  </div>

                  {/* Sign In Button */}
                  <button
                    type="submit"
                    disabled={isLoggingIn}
                    className="mt-6 flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-[#6e3bfa] to-[#8742ff] hover:from-[#6230e8] hover:to-[#7834eb] py-3 px-4 text-sm font-semibold text-white shadow-md shadow-violet-500/25 active:scale-[0.99] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isLoggingIn ? (
                      <>
                        <Loader2 size={18} className="animate-spin mr-2" />
                        <span>Signing in...</span>
                      </>
                    ) : (
                      'Sign in'
                    )}
                  </button>
                </form>

                {/* Secured Note */}
                <div className="mt-5 flex items-start gap-2 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  <ShieldCheck size={16} className="text-slate-400 dark:text-slate-500 shrink-0 mt-0.5" />
                  <span>
                    Secured with role-based access. Need an account?{' '}
                    <button
                      type="button"
                      onClick={() => setIsSignUp(true)}
                      className="text-violet-600 hover:underline dark:text-violet-400 font-medium"
                    >
                      Contact your HR admin.
                    </button>
                  </span>
                </div>

                {/* Demo Credentials Quick-Fill helper */}
                <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-xs dark:border-slate-800">
                  <span className="text-slate-400 dark:text-slate-500">Quick demo login:</span>
                  <button
                    type="button"
                    onClick={fillDemoCredentials}
                    className="font-semibold text-violet-600 hover:text-violet-700 dark:text-violet-400 hover:underline transition"
                  >
                    Auto-fill Admin
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Subtitle footnote as shown in reference */}
          <p className="mt-4 text-center text-xs text-slate-400 dark:text-slate-500 select-none">
            Preview only: any details show the error state.
          </p>
        </div>

        {/* Mobile footer */}
        <div className="relative z-10 pt-4 text-center lg:hidden">
          <p className="text-xs text-slate-400 font-medium">
            © 2026 HRONE · by Jai
          </p>
        </div>
      </main>
    </div>
  );
}
