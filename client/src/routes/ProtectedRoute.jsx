import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { selectAuthStatus } from '../features/auth/authSlice';
import { AppSplash } from '../components/ui/Skeleton';

// Wraps any route tree that requires the user to be logged in.
// While the app is still figuring out auth status (bootstrapAuth running
// on first load), we show a loading state instead of redirecting — a
// redirect that fires too early would kick an already-logged-in user
// (who refreshed the page) straight to /login.
export default function ProtectedRoute() {
  const status = useSelector(selectAuthStatus);
  const location = useLocation();

  if (status === 'idle' || status === 'loading') {
    return <AppSplash />;
  }

  if (status !== 'authenticated') {
    // Remember where the user was heading so login can send them back.
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
