import { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, Link, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Menu, Moon, Sun, LayoutDashboard, Users, Building2, Briefcase, Boxes, LogOut, Clock, Users2, CalendarDays, CheckSquare, Wallet, UserCircle, ScrollText, X } from 'lucide-react';
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
  // Desktop: `collapsed` shrinks the sidebar to icon-only.
  // Mobile (<lg): `mobileOpen` slides the sidebar in/out as an overlay drawer.
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const mode = useSelector((state) => state.theme.mode);
  const user = useSelector(selectCurrentUser);

  // Close the mobile drawer automatically whenever the route changes.
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    await dispatch(logoutUser());
    navigate('/login', { replace: true });
  };

  const visibleNavItems = navItems.filter((item) => !item.roles || item.roles.includes(user?.role));

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950">
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r border-slate-200 bg-white transition-transform dark:border-slate-800 dark:bg-slate-900 lg:static lg:translate-x-0 lg:transition-[width] ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        } ${collapsed ? 'lg:w-16' : 'lg:w-64'} w-64`}
      >
        <div className="flex h-16 items-center justify-between gap-2 px-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 shrink-0 rounded-lg bg-indigo-600" />
            {!collapsed && <span className="font-semibold text-slate-900 dark:text-white">Enterprise HRMS</span>}
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden"
          >
            <X size={18} />
          </button>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-2">
          {visibleNavItems.map(({ to, label, icon: Icon }) => (
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
              <Icon size={18} className="shrink-0" />
              <span className={collapsed ? 'lg:hidden' : ''}>{label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-16 items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-900 sm:gap-4 sm:px-4">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 lg:hidden"
            >
              <Menu size={20} />
            </button>
            <button
              onClick={() => setCollapsed((c) => !c)}
              className="hidden rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 lg:block"
            >
              <Menu size={20} />
            </button>
            <div className="hidden md:block">
              <GlobalSearch />
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1 sm:gap-3">
            <button
              onClick={() => dispatch(toggleTheme())}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              {mode === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <NotificationBell />
            <Link to="/profile" className="flex items-center gap-2">
              <div className="h-8 w-8 shrink-0 rounded-full bg-indigo-600 text-center text-sm leading-8 text-white">
                {user?.email?.[0]?.toUpperCase() || 'U'}
              </div>
              <div className="hidden text-left lg:block">
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

        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
