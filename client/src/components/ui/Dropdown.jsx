import { useEffect, useId, useRef, useState } from 'react';
import clsx from 'clsx';

// Minimal menu: click to toggle, click-outside / Escape to close, arrow
// keys move between items, focus returns to the trigger. Used for the
// user menu and row-level "more" actions.
export default function Dropdown({ trigger, items, align = 'right', className = '', menuClassName = '' }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const menuRef = useRef(null);
  const triggerRef = useRef(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const onClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
        return;
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        const items = [...(menuRef.current?.querySelectorAll('[role="menuitem"]:not([disabled])') || [])];
        if (!items.length) return;
        e.preventDefault();
        const index = items.indexOf(document.activeElement);
        const next = e.key === 'ArrowDown' ? (index + 1) % items.length : (index - 1 + items.length) % items.length;
        items[next].focus();
      }
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    requestAnimationFrame(() => menuRef.current?.querySelector('[role="menuitem"]')?.focus());
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className={clsx('relative', className)} ref={containerRef}>
      {trigger({ ref: triggerRef, open, toggle: () => setOpen((o) => !o), 'aria-haspopup': 'menu', 'aria-expanded': open, 'aria-controls': menuId })}
      {open && (
        <div
          id={menuId}
          ref={menuRef}
          role="menu"
          className={clsx(
            'absolute z-50 mt-2 min-w-48 origin-top animate-scale-in rounded-xl border border-slate-200 bg-white p-1 shadow-popover dark:border-slate-700 dark:bg-slate-900',
            align === 'right' ? 'right-0' : 'left-0',
            menuClassName
          )}
        >
          {items.map((item, index) =>
            item.type === 'separator' ? (
              <div key={`sep-${index}`} role="separator" className="my-1 h-px bg-slate-100 dark:bg-slate-800" />
            ) : item.type === 'label' ? (
              <div key={`label-${index}`} className="px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {item.label}
              </div>
            ) : (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={() => {
                  setOpen(false);
                  item.onSelect?.();
                }}
                className={clsx(
                  'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors disabled:opacity-50',
                  item.tone === 'danger'
                    ? 'text-red-600 hover:bg-red-50 focus:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10 dark:focus:bg-red-500/10'
                    : 'text-slate-700 hover:bg-slate-100 focus:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 dark:focus:bg-slate-800'
                )}
              >
                {item.icon && <item.icon size={15} aria-hidden="true" className="shrink-0 opacity-80" />}
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {item.hint && <span className="text-xs text-slate-500 dark:text-slate-400">{item.hint}</span>}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}
