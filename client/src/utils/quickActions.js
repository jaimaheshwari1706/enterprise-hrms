import { UserPlus, Wallet, CalendarCheck, Building2, Users, Clock, CalendarDays, UserCircle, ScrollText, Briefcase, Layers } from 'lucide-react';

// Role-scoped shortcuts for the dashboard. Every entry here maps to a route
// the role is actually allowed to open (mirrors RoleRoute in AppRoutes), so
// nothing is shown that the user can't do.
const ACTIONS = {
  EMPLOYEE: [
    { to: '/attendance', label: 'Check in / out', icon: Clock },
    { to: '/leaves', label: 'Apply for leave', icon: CalendarDays },
    { to: '/payroll', label: 'My payslips', icon: Wallet },
    { to: '/profile', label: 'My profile', icon: UserCircle },
  ],
  MANAGER: [
    { to: '/attendance/team', label: 'Team attendance', icon: Users },
    { to: '/leaves/approvals?status=Pending', label: 'Pending approvals', icon: CalendarCheck },
    { to: '/employees', label: 'Team directory', icon: Briefcase },
    { to: '/attendance', label: 'Check in / out', icon: Clock },
    { to: '/leaves', label: 'Apply for leave', icon: CalendarDays },
  ],
  HR_ADMIN: [
    { to: '/employees/new', label: 'Add employee', icon: UserPlus },
    { to: '/payroll/manage', label: 'Manage payroll', icon: Wallet },
    { to: '/leaves/approvals?status=Pending', label: 'Approve leave', icon: CalendarCheck },
    { to: '/attendance/team', label: 'Team attendance', icon: Users },
    { to: '/organization', label: 'Organization settings', icon: Building2 },
  ],
  SUPER_ADMIN: [
    { to: '/employees/new', label: 'Add employee', icon: UserPlus },
    { to: '/organization', label: 'Organization settings', icon: Building2 },
    { to: '/departments', label: 'Departments', icon: Layers },
    { to: '/payroll/manage', label: 'Manage payroll', icon: Wallet },
    { to: '/leaves/approvals?status=Pending', label: 'Approve leave', icon: CalendarCheck },
    { to: '/audit-logs', label: 'Audit logs', icon: ScrollText },
  ],
};

export function quickActionsFor(user) {
  if (!user) return [];
  const actions = ACTIONS[user.role] || ACTIONS.EMPLOYEE;
  // Self-service pages need an employee profile; admin logins without one
  // shouldn't be sent to a page that only shows "no profile linked".
  const selfService = new Set(['/attendance', '/leaves', '/payroll']);
  return actions.filter((a) => user.employee || !selfService.has(a.to));
}

