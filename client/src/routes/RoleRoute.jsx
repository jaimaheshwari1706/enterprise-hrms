import { Navigate, Outlet } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { selectCurrentUser } from '../features/auth/authSlice';

// Usage: <Route element={<RoleRoute allowed={['HR_ADMIN','SUPER_ADMIN']} />}>...</Route>
// Must be nested inside <ProtectedRoute /> so the user is already guaranteed.
// The server enforces the same matrix; this only keeps the UI honest.
export default function RoleRoute({ allowed }) {
  const user = useSelector(selectCurrentUser);

  if (!user || !allowed.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
