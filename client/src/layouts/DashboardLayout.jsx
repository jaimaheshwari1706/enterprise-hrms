import { useEffect, useState } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Menu, Moon, Sun, LayoutDashboard, Users, Building2, Briefcase, Boxes, LogOut, Clock, Users2,
  CalendarDays, CheckSquare, Wallet, UserCircle, ScrollText, X, PanelLeftClose, PanelLeftOpen,
  ChevronDown, Settings2, Search,
} from 'lucide-react';
import clsx from 'clsx';
import { toggleTheme } from '../features/theme/themeSlice';
import { selectCurrentUser, logoutUser } from '../features/auth/authSlice';
import NotificationBell from '../components/NotificationBell';
import GlobalSearch from '../components/GlobalSearch';
import { Avatar, Dropdown, BrandMark } from '../components/ui';
import { fullName, roleLabel } from '../utils/format';

const HR_ROLES = ['HR_ADMIN', 'SUPER_ADMIN'];
const LEAD_ROLES = ['HR_ADMIN', 'SUPER_ADMIN', 'MANAGER'];

// Navigation is grouped by job-to-be-done. Items with `roles` are hidden
// for everyone else (the server enforces the same matrix).
const NAV_SECTIONS = [
  {
    title: 'Overview',
    items: [{ to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, end: true }],
  },
  {
    title: 'People',
    items: [
      { to: '/employees', label: 'Employees', icon: Users, end: false },
      { to: '/departments', label: 'Departments', icon: Boxes },
      { to: '/designations', label: 'Designations', icon: Briefcase },
    ],
  },
  {
    title: 'Time & Leave',
    items: [
      { to: '/attendance', label: 'My Attendance', icon: Clock, end: true },
      { to: '/attendance/team', label: 'Team Attendance', icon: Users2, roles: LEAD_ROLES },
      { to: '/leaves', label: 'My Leave', icon: CalendarDays, end: true },
      { to: '/leaves/approvals', label: 'Leave Approvals', icon: CheckSquare, roles: LEAD_ROLES },
    ],
  },
  {
    title: 'Payroll',
    items: [
      { to: '/payroll', label: 'My Payroll', icon: Wallet, end: true },
      { to: '/payroll/manage', label: 'Manage Payroll', icon: Settings2, roles: HR_ROLES },
    ],
  },
  {
    title: 'Administration',
    roles: HR_ROLES,
    items: [
      { to: '/organization', label: 'Organization', icon: Building2, roles: HR_ROLES },
      { to: '/audit-logs', label: 'Audit Logs', icon: ScrollText, roles: HR_ROLES },
    ],
  },
];

const COLLAPSE_KEY = 'hrms-sidebar-collapsed';

function readCollapsed() {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === '1';
  } catch {
    return false;
  }
}

export default function DashboardLayout() {
  // Desktop: `collapsed` shrinks the sidebar to icon-only (persisted).
  // Mobile (<lg): `mobileOpen` slides the sidebar in/out as an overlay drawer.
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const mode = useSelector((state) => state.theme.mode);
  const user = useSelector(selectCurrentUser);

  // Close the mobile drawer automatically whenever the route changes.
  useEffect(() => {
    setMobileOpen(false);
    setSearchOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [collapsed]);

  // Escape closes the drawer; ⌘K / Ctrl+K focuses global search.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') setMobileOpen(false);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
        document.getElementById('global-search-input')?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const handleLogout = async () => {
    await dispatch(logoutUser());
    navigate('/login', { replace: true });
  };

  const role = user?.role;
  const sections = NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => !item.roles || item.roles.includes(role)),
  })).filter((section) => section.items.length > 0 && (!section.roles || section.roles.includes(role)));

  const displayName = fullName(user?.employee) || user?.email || 'User';

  const sidebarContent = (
    <>
      <div className={clsx('flex h-16 shrink-0 items-center gap-2.5 border-b border-slate-200 px-4 dark:border-slate-800', collapsed && 'lg:justify-center lg:px-0')}>
        <BrandMark />
        <span className={clsx('truncate text-[15px] font-semibold text-slate-900 dark:text-white', collapsed && 'lg:hidden')}>Enterprise HRMS</span>
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          aria-label="Close navigation"
          className="ml-auto rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 lg:hidden dark:hover:bg-slate-800"
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4" aria-label="Main navigation">
        {sections.map((section) => (
          <div key={section.title}>
            <p className={clsx('mb-1.5 px-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400', collapsed && 'lg:sr-only')}>
              {section.title}
            </p>
            <ul className="space-y-0.5">
              {section.items.map(({ to, label, icon: Icon, end }) => (
                <li key={to}>
                  <NavLink
                    to={to}
                    end={end}
                    title={collapsed ? label : undefined}
                    className={({ isActive }) =>
                      clsx(
                        'group relative flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors',
                        collapsed && 'lg:justify-center lg:px-0',
                        isActive
                          ? 'bg-primary-50 text-primary-700 dark:bg-primary-500/10 dark:text-primary-200'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-r bg-primary-600 dark:bg-primary-400" aria-hidden="true" />}
                        <Icon size={18} className="shrink-0" aria-hidden="true" />
                        <span className={clsx('truncate', collapsed && 'lg:hidden')}>{label}</span>
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className={clsx('shrink-0 border-t border-slate-200 p-3 dark:border-slate-800', collapsed && 'lg:px-2')}>
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-pressed={collapsed}
          className={clsx(
            'hidden w-full items-center gap-3 rounded-lg px-2.5 py-2 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-800 lg:flex dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white',
            collapsed && 'lg:justify-center lg:px-0'
          )}
        >
          {collapsed ? <PanelLeftOpen size={18} aria-hidden="true" /> : <PanelLeftClose size={18} aria-hidden="true" />}
          <span className={clsx(collapsed && 'lg:hidden')}>Collapse</span>
        </button>
      </div>
    </>
  );

  return (
    <div className="flex h-dvh bg-slate-50 dark:bg-slate-950">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-primary-600 focus:px-3 focus:py-2 focus:text-sm focus:text-white"
      >
        Skip to content
      </a>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 animate-fade-in bg-slate-900/50 backdrop-blur-[1px] lg:hidden" onClick={() => setMobileOpen(false)} aria-hidden="true" />
      )}

      <aside
        aria-label="Sidebar"
        className={clsx(
          'app-chrome fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-slate-200 bg-white transition-transform duration-200 ease-out dark:border-slate-800 dark:bg-slate-900',
          'lg:static lg:max-w-none lg:translate-x-0 lg:transition-[width] lg:duration-200',
          mobileOpen ? 'translate-x-0 shadow-modal' : '-translate-x-full',
          collapsed ? 'lg:w-[68px]' : 'lg:w-64'
        )}
      >
        {sidebarContent}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* z-30: the header's backdrop-blur creates a stacking context, so
            without an explicit z-index the search popover would paint
            underneath the (animated) page content below it. */}
        <header className="app-chrome relative z-30 flex h-16 shrink-0 items-center justify-between gap-2 border-b border-slate-200 bg-white/90 px-3 backdrop-blur sm:gap-4 sm:px-5 dark:border-slate-800 dark:bg-slate-900/90">
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden dark:text-slate-400 dark:hover:bg-slate-800"
            >
              <Menu size={20} aria-hidden="true" />
            </button>
            <div className="hidden w-full max-w-md md:block">
              <GlobalSearch />
            </div>
            <button
              type="button"
              onClick={() => setSearchOpen((o) => !o)}
              aria-label="Search"
              aria-expanded={searchOpen}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 md:hidden dark:text-slate-400 dark:hover:bg-slate-800"
            >
              <Search size={18} aria-hidden="true" />
            </button>
          </div>

          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <button
              type="button"
              onClick={() => dispatch(toggleTheme())}
              aria-label={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              title={mode === 'dark' ? 'Light mode' : 'Dark mode'}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              {mode === 'dark' ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
            </button>
            <NotificationBell />
            <Dropdown
              trigger={({ ref, toggle, ...aria }) => (
                <button
                  ref={ref}
                  type="button"
                  onClick={toggle}
                  {...aria}
                  className="flex items-center gap-2 rounded-lg py-1 pl-1 pr-2 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <Avatar src={user?.employee?.profileImageUrl} name={displayName} size={30} />
                  <div className="hidden text-left lg:block">
                    <p className="max-w-[160px] truncate text-xs font-medium leading-tight text-slate-900 dark:text-white">{displayName}</p>
                    <p className="text-[11px] leading-tight text-slate-500 dark:text-slate-400">{roleLabel(user?.role)}</p>
                  </div>
                  <ChevronDown size={14} className="hidden text-slate-400 lg:block" aria-hidden="true" />
                  <span className="sr-only">Account menu</span>
                </button>
              )}
              items={[
                { type: 'label', label: user?.email },
                { label: 'My profile', icon: UserCircle, onSelect: () => navigate('/profile') },
                { label: 'My attendance', icon: Clock, onSelect: () => navigate('/attendance') },
                { type: 'separator' },
                { label: 'Sign out', icon: LogOut, tone: 'danger', onSelect: handleLogout },
              ]}
            />
          </div>
        </header>

        {searchOpen && (
          <div className="relative z-30 border-b border-slate-200 bg-white p-3 md:hidden dark:border-slate-800 dark:bg-slate-900">
            <GlobalSearch autoFocus />
          </div>
        )}

        <main id="main-content" className="flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6 lg:px-8" tabIndex={-1}>
          <div key={location.pathname} className="mx-auto w-full max-w-[1400px] animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
