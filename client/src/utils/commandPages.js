import {
  LayoutDashboard, Users, UserPlus, Layers, Briefcase, Clock, CalendarDays, CalendarCheck, Wallet, Building2, ScrollText, UserCircle,
} from 'lucide-react';

// Pages and actions the command palette can jump to. `roles` mirrors the
// RoleRoute guards in AppRoutes; `needsProfile` hides self-service pages
// from admin logins that have no employee record.
const ALL = ['SUPER_ADMIN', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE'];
const LEADS = ['SUPER_ADMIN', 'HR_ADMIN', 'MANAGER'];
const HR = ['SUPER_ADMIN', 'HR_ADMIN'];

export const COMMAND_PAGES = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ALL, keywords: 'home overview' },
  { to: '/employees', label: 'Employees', icon: Users, roles: ALL, keywords: 'directory people staff' },
  { to: '/employees/new', label: 'Add employee', icon: UserPlus, roles: HR, keywords: 'new hire create onboard', action: true },
  { to: '/departments', label: 'Departments', icon: Layers, roles: ALL },
  { to: '/designations', label: 'Designations', icon: Briefcase, roles: ALL, keywords: 'titles roles' },
  { to: '/attendance', label: 'My attendance', icon: Clock, roles: ALL, needsProfile: true, keywords: 'check in check out' },
  { to: '/attendance/team', label: 'Team attendance', icon: Clock, roles: LEADS },
  { to: '/leaves', label: 'My leave', icon: CalendarDays, roles: ALL, needsProfile: true, keywords: 'apply time off vacation' },
  { to: '/leaves/approvals?status=Pending', label: 'Leave approvals', icon: CalendarCheck, roles: LEADS, keywords: 'approve pending requests' },
  { to: '/payroll', label: 'My payroll', icon: Wallet, roles: ALL, needsProfile: true, keywords: 'payslip salary' },
  { to: '/payroll/manage', label: 'Payroll management', icon: Wallet, roles: HR, keywords: 'generate salary payslips' },
  { to: '/organization', label: 'Organization settings', icon: Building2, roles: HR, keywords: 'company holidays working days policy' },
  { to: '/audit-logs', label: 'Audit logs', icon: ScrollText, roles: HR, keywords: 'activity history security' },
  { to: '/profile', label: 'My profile', icon: UserCircle, roles: ALL, keywords: 'account password sessions' },
];

export function matchCommandPages(query, user) {
  if (!user) return [];
  const q = query.trim().toLowerCase();
  return COMMAND_PAGES.filter((page) => {
    if (!page.roles.includes(user.role)) return false;
    if (page.needsProfile && !user.employee) return false;
    if (!q) return true;
    return page.label.toLowerCase().includes(q) || (page.keywords || '').includes(q);
  });
}
