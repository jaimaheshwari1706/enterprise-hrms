import { Outlet } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Moon, Sun, ShieldCheck, Clock, Wallet } from 'lucide-react';
import { toggleTheme } from '../features/theme/themeSlice';
import { BrandMark } from '../components/ui';

const POINTS = [
  { icon: Clock, title: 'Attendance and leave in one place', text: 'Check in, request time off and track approvals without email threads.' },
  { icon: Wallet, title: 'Payroll you can trust', text: 'Monthly payroll generated from configured salary structures, with a clear audit trail.' },
  { icon: ShieldCheck, title: 'Role-based access', text: 'Employees, managers and HR each see exactly what they need — nothing more.' },
];

export default function AuthLayout() {
  const dispatch = useDispatch();
  const mode = useSelector((state) => state.theme.mode);

  return (
    <div className="grid min-h-dvh bg-slate-50 lg:grid-cols-[1.1fr_1fr] dark:bg-slate-950">
      <section className="relative hidden flex-col justify-between overflow-hidden bg-primary-700 p-12 text-white lg:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{ backgroundImage: 'radial-gradient(circle at 20% 20%, rgba(255,255,255,0.18) 0, transparent 40%), radial-gradient(circle at 80% 80%, rgba(255,255,255,0.12) 0, transparent 45%)' }}
          aria-hidden="true"
        />
        <div className="relative flex items-center gap-3">
          <BrandMark className="h-10 w-10 bg-white/15 ring-1 ring-white/30" />
          <span className="text-lg font-semibold">Enterprise HRMS</span>
        </div>
        <div className="relative max-w-md">
          <h2 className="text-3xl font-semibold leading-tight tracking-tight">Run people operations from a single, calm workspace.</h2>
          <ul className="mt-10 space-y-6">
            {POINTS.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/20">
                  <Icon size={18} aria-hidden="true" />
                </div>
                <div>
                  <p className="font-medium">{title}</p>
                  <p className="mt-0.5 text-sm text-primary-100">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-primary-200">© {new Date().getFullYear()} Enterprise HRMS</p>
      </section>

      <section className="flex flex-col p-4 sm:p-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 lg:invisible">
            <BrandMark />
            <span className="font-semibold text-slate-900 dark:text-white">Enterprise HRMS</span>
          </div>
          <button
            type="button"
            onClick={() => dispatch(toggleTheme())}
            aria-label={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            {mode === 'dark' ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
          </button>
        </div>
        <div className="flex flex-1 items-center justify-center py-8">
          <div className="w-full max-w-sm animate-fade-in-up">
            <Outlet />
          </div>
        </div>
      </section>
    </div>
  );
}
