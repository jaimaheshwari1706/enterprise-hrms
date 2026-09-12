import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { selectCurrentUser } from '../features/auth/authSlice';
import { quickActionsFor } from '../utils/quickActions';

export default function QuickActions({ className = '' }) {
  const user = useSelector(selectCurrentUser);
  const actions = quickActionsFor(user);
  if (actions.length === 0) return null;

  return (
    <nav aria-label="Quick actions" className={className}>
      <ul className="flex flex-wrap gap-2">
        {actions.map((action) => (
          <li key={action.to}>
            <Link
              to={action.to}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-xs transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-700 dark:hover:bg-slate-800 dark:hover:text-white"
            >
              <action.icon size={16} className="text-primary-600 dark:text-primary-400" aria-hidden="true" />
              {action.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
