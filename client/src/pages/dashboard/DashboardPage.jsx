import { useSelector } from 'react-redux';
import { selectCurrentUser } from '../../features/auth/authSlice';
import HRDashboard from './HRDashboard';
import ManagerDashboard from './ManagerDashboard';
import EmployeeDashboard from './EmployeeDashboard';

// Renders the correct role-specific dashboard. HR_ADMIN/SUPER_ADMIN see the
// org-wide view, MANAGER sees their team, everyone else sees their own
// personal dashboard.
export default function DashboardPage() {
  const user = useSelector(selectCurrentUser);

  if (user?.role === 'HR_ADMIN' || user?.role === 'SUPER_ADMIN') {
    return <HRDashboard />;
  }
  if (user?.role === 'MANAGER') {
    return <ManagerDashboard />;
  }
  return <EmployeeDashboard />;
}
