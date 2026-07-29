import { useState } from 'react';
import { Outlet, NavLink, useNavigate, Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Menu, Moon, Sun, LayoutDashboard, Users, Building2, Briefcase, Boxes, LogOut, Clock, Users2, CalendarDays, CheckSquare, Wallet, UserCircle, ScrollText } from 'lucide-react';
import { toggleTheme } from '../features/theme/themeSlice';
import { selectCurrentUser, logoutUser } from '../features/auth/authSlice';
import NotificationBell from '../components/NotificationBell';
import GlobalSearch from '../components/GlobalSearch';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/employees', label: 'Employees', icon: Users },
  { to: '/attendance', label: 'Attendance', icon: Clock },
  { to: '/attendance/team', label: 'Team Attendance', icon: Users2, roles: ['HR_ADMIN', 'SUPER_ADMIN', 'MANAGER'] },
  { to: '/leaves', label: 'Leave', icon: CalendarDays },
  { to: '/leaves/approvals', label: 'Leave Approvals', icon: CheckSquare, roles: ['HR_ADMIN', 'SUPER_ADMIN', 'MANAGER'] },
  { to: '/payroll', label: 'Payroll', icon: Wallet },
  { to: '/payroll/manage', label: 'Manage Payroll', icon: Wallet, roles: ['HR_ADMIN', 'SUPER_ADMIN'] },
  { to: '/departments', label: 'Departments', icon: Boxes },
  { to: '/designations', label: 'Designations', icon: Briefcase },
  { to: '/organization', label: 'Organization', icon: Building2, roles: ['HR_ADMIN', 'SUPER_ADMIN'] },
  { to: '/audit-logs', label: 'Audit Logs', icon: ScrollText, roles: ['HR_ADMIN', 'SUPER_ADMIN'] },
  { to: '/profile', label: 'Profile', icon: UserCircle },
];

export default function DashboardLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const mode = useSelector((state) => state.theme.mode);
  const user = useSelector(selectCurrentUser);

  const handleLogout = async () => {
    await dispatch(logoutUser());
    navigate('/login', { replace: true });
  };

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950">
      <aside
        className={`flex flex-col border-r border-slate-200 bg-white transition-all dark:border-slate-800 dark:bg-slate-900 ${
          collapsed ? 'w-16' : 'w-64'
        }`}
      >
        <div className="flex h-16 items-center gap-2 px-4">
          <div className="h-8 w-8 shrink-0 rounded-lg bg-indigo-600" />
          {!collapsed && <span className="font-semibold text-slate-900 dark:text-white">Enterprise HRMS</span>}
        </div>
        <nav className="flex-1 space-y-1 px-2">
          {navItems
            .filter((item) => !item.roles || item.roles.includes(user?.role))
            .map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                }`
              }
            >
              <Icon size={18} />
              {!collapsed && label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-16 items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCollapsed((c) => !c)}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              <Menu size={20} />
            </button>
            <div className="hidden md:block">
              <GlobalSearch />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => dispatch(toggleTheme())}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              {mode === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <NotificationBell />
            <Link to="/profile" className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-indigo-600 text-center text-sm leading-8 text-white">
                {user?.email?.[0]?.toUpperCase() || 'U'}
              </div>
              <div className="hidden text-left sm:block">
                <p className="text-xs font-medium leading-tight text-slate-900 dark:text-white">{user?.email}</p>
                <p className="text-[11px] leading-tight text-slate-500 dark:text-slate-400">{user?.role}</p>
              </div>
            </Link>
            <button
              onClick={handleLogout}
              title="Log out"
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
