import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { Button } from '../components/ui';

export default function NotFoundPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-slate-50 px-4 text-center dark:bg-slate-950">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
        <Compass size={26} aria-hidden="true" />
      </div>
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-primary-600 dark:text-primary-400">404</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">Page not found</h1>
        <p className="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">The page you&apos;re looking for doesn&apos;t exist or may have been moved.</p>
      </div>
      <Link to="/dashboard">
        <Button variant="secondary">Back to dashboard</Button>
      </Link>
    </div>
  );
}
