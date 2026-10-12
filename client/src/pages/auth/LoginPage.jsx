import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Eye, EyeOff, Loader2, CheckCircle2, AlertCircle, ArrowLeft } from 'lucide-react';
import { loginUser, selectAuthStatus, selectSessionExpired, clearAuthError } from '../../features/auth/authSlice';
import { authApi } from '../../api/authApi';
import { getApiErrorMessage } from '../../utils/apiError';
import './neumorphic.css';

const loginSchema = z.object({
  email: z.string().trim().email('Enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const signUpSchema = z.object({
  fullName: z.string().trim().min(2, 'Name must be at least 2 characters'),
  email: z.string().trim().email('Enter a valid email address'),
  password: z.string()
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

  // Check URL query parameters for initial state, e.g. /login?mode=signup
  const queryParams = new URLSearchParams(location.search);
  const initialSignUp = queryParams.get('mode') === 'signup' || queryParams.get('signup') === 'true';

  const [isSignUp, setIsSignUp] = useState(initialSignUp);
  const [showPassword, setShowPassword] = useState(false);
  const [showSignUpPassword, setShowSignUpPassword] = useState(false);
  const [forgotPasswordMode, setForgotPasswordMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSubmitting, setForgotSubmitting] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState(false);
  const [forgotError, setForgotError] = useState(null);
  const [signUpSuccessMsg, setSignUpSuccessMsg] = useState(null);

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

  const [signUpError, setSignUpError] = useState(null);

  const onSignUpSubmit = async (values) => {
    setSignUpSuccessMsg(null);
    setSignUpError(null);
    try {
      const response = await authApi.register(values);
      const { accessToken, user } = response.data.data;
      // Store access token and redirect (auto-login)
      if (accessToken) {
        // Dispatch login success to update auth state
        const loginResult = dispatch(loginUser({ email: values.email, password: values.password }));
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
    <div className="neu-auth-body">
      {/* Top Window Bar (from preview title) */}
      <div className="neu-window-header">
        {/* <div className="neu-window-title">
          <Home size={15} className="text-[#E88A7A]" />
          <span>HRM Enterprises</span>
        </div> */}
        {/* <button
          type="button"
          onClick={fillDemoCredentials}
          className="neu-button neu-button-sm"
          title="Auto-fill demo admin credentials"
        >
          Fill Demo Credentials
        </button> */}
      </div>

      {/* Main Neumorphic Card with Sliding Drawer Animation */}
      <div className={`neu-card-container ${isSignUp ? 'right-panel-active' : ''}`}>

     
        <div className="neu-form-container neu-sign-in-container">
          {forgotPasswordMode ? (
           
            <div className="w-full flex flex-col items-center">
              <div className="neu-badge">
                <Home size={16} className="neu-badge-icon" />
                <span>HRM</span>
              </div>
              <h2 className="neu-heading text-2xl">Reset Password</h2>
              <p className="neu-subtitle">
                Enter your work email and we&apos;ll send you a password recovery link.
              </p>

              {forgotSuccess ? (
                <div className="neu-alert success">
                  <CheckCircle2 size={18} />
                  <span>Reset link sent! Please check your inbox.</span>
                </div>
              ) : (
                <form onSubmit={handleForgotPassword} className="w-full" noValidate>
                  {forgotError && (
                    <div className="neu-alert danger">
                      <AlertCircle size={18} />
                      <span>{forgotError}</span>
                    </div>
                  )}

                  <div className="neu-input-group">
                    <input
                      type="email"
                      placeholder="Email Address"
                      className="neu-input"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      required
                    />
                  </div>

                  <div className="mt-4 flex flex-col items-center gap-3">
                    <button
                      type="submit"
                      disabled={forgotSubmitting}
                      className="neu-button"
                    >
                      {forgotSubmitting ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          <span>Sending…</span>
                        </>
                      ) : (
                        'Send Reset Link'
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setForgotPasswordMode(false);
                        setForgotSuccess(false);
                        setForgotError(null);
                      }}
                      className="neu-link inline-flex items-center gap-1.5"
                    >
                      <ArrowLeft size={14} /> Back to Sign In
                    </button>
                  </div>
                </form>
              )}

              {forgotSuccess && (
                <button
                  type="button"
                  onClick={() => {
                    setForgotPasswordMode(false);
                    setForgotSuccess(false);
                  }}
                  className="neu-button mt-4"
                >
                  Back to Sign In
                </button>
              )}
            </div>
          ) : (
            /* Standard Sign In Form */
            <div className="w-full flex flex-col items-center">
              <div className="neu-badge">
                <Home size={16} className="neu-badge-icon" />
                <span>HRM</span>
              </div>

              <h2 className="neu-heading">Welcome Back!</h2>
              <p className="neu-subtitle">
                To keep connected with us please login with your personal info
              </p>

              {expired && !serverError && (
                <div className="neu-alert warning">
                  <AlertCircle size={18} />
                  <span>Your session has expired. Please sign in again.</span>
                </div>
              )}

              {serverError && (
                <div className="neu-alert danger">
                  <AlertCircle size={18} />
                  <span>{serverError}</span>
                </div>
              )}

              <form onSubmit={handleSubmitLogin(onLoginSubmit)} className="w-full" noValidate>
                <div className="neu-input-group">
                  <input
                    type="email"
                    placeholder="Email Address"
                    autoComplete="email"
                    className={`neu-input ${loginErrors.email ? 'error' : ''}`}
                    {...registerLogin('email')}
                  />
                  {loginErrors.email && (
                    <div className="neu-input-error-msg">{loginErrors.email.message}</div>
                  )}
                </div>

                <div className="neu-input-group">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Password"
                    autoComplete="current-password"
                    className={`neu-input pr-12 ${loginErrors.password ? 'error' : ''}`}
                    {...registerLogin('password')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="neu-password-toggle"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                  {loginErrors.password && (
                    <div className="neu-input-error-msg">{loginErrors.password.message}</div>
                  )}
                </div>

                <div className="mb-5 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setForgotPasswordMode(true)}
                    className="neu-link"
                  >
                    Forgot password?
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={isLoggingIn}
                  className="neu-button"
                >
                  {isLoggingIn ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Signing In…</span>
                    </>
                  ) : (
                    'Sign In'
                  )}
                </button>
              </form>

              {/* Mobile Only: Switch to Sign Up */}
              <div className="neu-mobile-toggle md:hidden">
                <span>Don&apos;t have an account?</span>
                <button
                  type="button"
                  onClick={() => setIsSignUp(true)}
                  className="neu-link text-[#E88A7A]"
                >
                  Sign Up
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ===================================================================
            SIGN UP FORM CONTAINER (Revealed on Right side when isSignUp is true)
            =================================================================== */}
        <div className="neu-form-container neu-sign-up-container">
          <div className="w-full flex flex-col items-center">
            <h2 className="neu-heading">Create Account</h2>
            <p className="neu-subtitle">Join HRM Enterprises today</p>

            {signUpSuccessMsg && (
              <div className="neu-alert success text-left text-xs mb-4">
                <CheckCircle2 size={18} className="shrink-0" />
                <span>{signUpSuccessMsg}</span>
              </div>
            )}

            {signUpError && (
              <div className="neu-alert danger text-left text-xs mb-4">
                <AlertCircle size={18} className="shrink-0" />
                <span>{signUpError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitSignUp(onSignUpSubmit)} className="w-full" noValidate>
              <div className="neu-input-group">
                <input
                  type="text"
                  placeholder="Full Name"
                  autoComplete="name"
                  className={`neu-input ${signUpErrors.fullName ? 'error' : ''}`}
                  {...registerSignUp('fullName')}
                />
                {signUpErrors.fullName && (
                  <div className="neu-input-error-msg">{signUpErrors.fullName.message}</div>
                )}
              </div>

              <div className="neu-input-group">
                <input
                  type="email"
                  placeholder="Email Address"
                  autoComplete="email"
                  className={`neu-input ${signUpErrors.email ? 'error' : ''}`}
                  {...registerSignUp('email')}
                />
                {signUpErrors.email && (
                  <div className="neu-input-error-msg">{signUpErrors.email.message}</div>
                )}
              </div>

              <div className="neu-input-group">
                <input
                  type={showSignUpPassword ? 'text' : 'password'}
                  placeholder="Password"
                  autoComplete="new-password"
                  className={`neu-input pr-12 ${signUpErrors.password ? 'error' : ''}`}
                  {...registerSignUp('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowSignUpPassword((v) => !v)}
                  className="neu-password-toggle"
                  aria-label={showSignUpPassword ? 'Hide password' : 'Show password'}
                >
                  {showSignUpPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
                {signUpErrors.password && (
                  <div className="neu-input-error-msg">{signUpErrors.password.message}</div>
                )}
              </div>

              <div className="mt-2 flex flex-col items-center">
                <button
                  type="submit"
                  disabled={isSubmittingSignUp}
                  className="neu-button"
                >
                  {isSubmittingSignUp ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Creating…</span>
                    </>
                  ) : (
                    'Sign Up'
                  )}
                </button>
              </div>
            </form>

            {/* Mobile Only: Switch back to Sign In */}
            <div className="neu-mobile-toggle md:hidden">
              <span>Already have an account?</span>
              <button
                type="button"
                onClick={() => setIsSignUp(false)}
                className="neu-link text-[#E88A7A]"
              >
                Sign In
              </button>
            </div>
          </div>
        </div>

        {/* ===================================================================
            OVERLAY CONTAINER (The Sliding Soft Drawer Panel)
            =================================================================== */}
        <div className="neu-overlay-container">
          <div className="neu-overlay">

            {/* OVERLAY LEFT PANEL:
                Visible when isSignUp === true (slid over to the left side!)
                EXACTLY AS SHOWN IN THE USER'S SCREENSHOT! */}
            <div className="neu-overlay-panel neu-overlay-left">
              <div className="neu-badge">
                <Home size={16} className="neu-badge-icon" />
                <span>HRM</span>
              </div>
              <h2 className="neu-heading">Welcome Back!</h2>
              <p className="neu-subtitle">
                To keep connected with us please login with your personal info
              </p>
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(false);
                  setForgotPasswordMode(false);
                }}
                className="neu-button"
              >
                Sign In
              </button>
            </div>

            {/* OVERLAY RIGHT PANEL:
                Visible when isSignUp === false (resting on the right side)
                Offers the user to slide open the drawer to create an account */}
            <div className="neu-overlay-panel neu-overlay-right">

              <h2 className="neu-heading">Create Account</h2>
              <p className="neu-subtitle">
                Join HRM Enterprises today and manage all your workspace operations
              </p>
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(true);
                  setForgotPasswordMode(false);
                }}
                className="neu-button"
              >
                Sign Up
              </button>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
