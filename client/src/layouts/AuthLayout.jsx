import { Outlet } from 'react-router-dom';

export default function AuthLayout() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-6 flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-indigo-600" />
          <span className="font-semibold text-slate-900 dark:text-white">Enterprise HRMS</span>
        </div>
        <Outlet />
      </div>
    </div>
  );
}
