// CSS-only tooltip for short hints on icons/labels. Shown on hover and on
// keyboard focus; the visible text is also the accessible description.
import { useId } from 'react';

export default function Tooltip({ text, children, side = 'top' }) {
  const id = useId();
  const position = side === 'bottom' ? 'top-full mt-1.5' : 'bottom-full mb-1.5';
  return (
    <span className="group relative inline-flex" aria-describedby={id}>
      {children}
      <span
        id={id}
        role="tooltip"
        className={`pointer-events-none absolute left-1/2 z-40 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[11px] font-medium text-white opacity-0 shadow-popover transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 dark:bg-slate-700 ${position}`}
      >
        {text}
      </span>
    </span>
  );
}
