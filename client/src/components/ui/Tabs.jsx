import { useId, useRef } from 'react';
import clsx from 'clsx';

// Accessible tab strip: arrow keys move between tabs, Home/End jump, the
// active tab is announced. Panels are rendered by the parent so pages keep
// control over lazy loading per tab — which is why no aria-controls is set
// (it must reference an element that exists, and the parent owns those).
export default function Tabs({ tabs, value, onChange, className = '' }) {
  const baseId = useId();
  const refs = useRef({});

  const onKeyDown = (event, index) => {
    const keys = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: tabs.length - 1 };
    if (!(event.key in keys)) return;
    event.preventDefault();
    const next = (keys[event.key] + tabs.length) % tabs.length;
    onChange(tabs[next].value);
    refs.current[tabs[next].value]?.focus();
  };

  return (
    <div role="tablist" aria-orientation="horizontal" className={clsx('flex gap-1 overflow-x-auto border-b border-slate-200 dark:border-slate-800', className)}>
      {tabs.map((tab, index) => {
        const active = tab.value === value;
        return (
          <button
            key={tab.value}
            ref={(el) => {
              refs.current[tab.value] = el;
            }}
            id={`${baseId}-${tab.value}`}
            role="tab"
            type="button"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(tab.value)}
            onKeyDown={(e) => onKeyDown(e, index)}
            className={clsx(
              '-mb-px inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors',
              active
                ? 'border-primary-600 text-primary-700 dark:border-primary-400 dark:text-primary-300'
                : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:text-slate-200'
            )}
          >
            {tab.icon && <tab.icon size={15} aria-hidden="true" />}
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={clsx(
                  'rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular',
                  active ? 'bg-primary-100 text-primary-700 dark:bg-primary-500/20 dark:text-primary-200' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
