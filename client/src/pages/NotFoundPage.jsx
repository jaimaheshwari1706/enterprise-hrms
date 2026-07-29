import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-2 bg-slate-50 dark:bg-slate-950">
      <p className="text-4xl font-bold text-slate-900 dark:text-white">404</p>
      <p className="text-slate-500 dark:text-slate-400">Page not found</p>
      <Link to="/dashboard" className="mt-2 text-sm text-indigo-600 hover:underline dark:text-indigo-400">
        Back to dashboard
      </Link>
    </div>
  );
}
