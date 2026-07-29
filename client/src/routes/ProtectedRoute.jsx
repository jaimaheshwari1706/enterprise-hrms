import { Navigate, Outlet } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { selectAuthStatus } from '../features/auth/authSlice';

// Wraps any route tree that requires the user to be logged in.
// While the app is still figuring out auth status (bootstrapAuth running
// on first load), we show a loading state instead of redirecting — a
// redirect that fires too early would kick an already-logged-in user
// (who refreshed the page) straight to /login.
export default function ProtectedRoute() {
  const status = useSelector(selectAuthStatus);

  if (status === 'idle' || status === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  if (status !== 'authenticated') {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
