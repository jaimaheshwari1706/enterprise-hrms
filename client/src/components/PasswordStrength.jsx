import { Check, X } from 'lucide-react';
import clsx from 'clsx';
import { PASSWORD_RULES as RULES } from '../utils/validation';

export default function PasswordStrength({ value = '' }) {
  if (!value) return null;
  const passed = RULES.filter((r) => r.test(value)).length;
  const strong = passed === RULES.length && value.length >= 12;
  return (
    <div className="space-y-1.5" aria-live="polite">
      <div className="flex gap-1" aria-hidden="true">
        {RULES.map((rule, i) => (
          <span
            key={rule.label}
            className={clsx('h-1 flex-1 rounded-full', i < passed ? (strong ? 'bg-emerald-500' : 'bg-amber-500') : 'bg-slate-200 dark:bg-slate-700')}
          />
        ))}
      </div>
      <ul className="grid grid-cols-1 gap-x-3 text-[11px] sm:grid-cols-3">
        {RULES.map((rule) => {
          const ok = rule.test(value);
          return (
            <li key={rule.label} className={clsx('flex items-center gap-1', ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400')}>
              {ok ? <Check size={12} aria-hidden="true" /> : <X size={12} aria-hidden="true" />}
              {rule.label}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
