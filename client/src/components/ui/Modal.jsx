import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import clsx from 'clsx';
import IconButton from './IconButton';

const SIZES = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Accessible dialog: portalled to <body>, role="dialog" + aria-modal,
// labelled by its title, traps Tab focus, closes on Escape / backdrop
// click, locks page scroll and returns focus to the opener on close.
export default function Modal({ open, onClose, title, description, children, footer, size = 'md', closeOnBackdrop = true, initialFocusRef }) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef(null);
  const contentRef = useRef(null);
  const openerRef = useRef(null);
  // Latest callbacks/refs without re-running the open/close effect: parents
  // often pass an inline onClose that changes on every render (e.g. while
  // the user types in a field), and re-running the effect would bounce
  // focus to the opener and back, swallowing keystrokes.
  const onCloseRef = useRef(onClose);
  const initialFocusRefRef = useRef(initialFocusRef);
  onCloseRef.current = onClose;
  initialFocusRefRef.current = initialFocusRef;

  useEffect(() => {
    if (!open) return undefined;
    openerRef.current = document.activeElement;

    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    // Prefer the first control in the body (a form field), then the footer
    // (a confirm button), and only then the close button / panel itself —
    // landing on "Close" first is never what the user came to do.
    const focusTarget =
      initialFocusRefRef.current?.current ||
      contentRef.current?.querySelector(FOCUSABLE) ||
      panelRef.current?.querySelector('[data-modal-footer] ' + FOCUSABLE.split(', ').join(', [data-modal-footer] ')) ||
      panelRef.current?.querySelector(FOCUSABLE) ||
      panelRef.current;
    const raf = requestAnimationFrame(() => focusTarget?.focus?.());

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onCloseRef.current?.();
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;
      const focusable = [...panelRef.current.querySelectorAll(FOCUSABLE)];
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = overflow;
      openerRef.current?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4" role="presentation">
      <div
        className="absolute inset-0 animate-fade-in bg-slate-900/60 backdrop-blur-[2px]"
        onClick={closeOnBackdrop ? onClose : undefined}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={clsx(
          'relative flex max-h-[calc(100dvh-1rem)] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-modal outline-none',
          'animate-fade-in-up sm:animate-scale-in sm:rounded-2xl dark:bg-slate-900 dark:ring-1 dark:ring-slate-800',
          SIZES[size]
        )}
      >
        <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-3 sm:px-6">
          <div className="min-w-0">
            {title && (
              <h2 id={titleId} className="text-base font-semibold text-slate-900 dark:text-white">
                {title}
              </h2>
            )}
            {description && (
              <p id={descriptionId} className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {description}
              </p>
            )}
          </div>
          <IconButton label="Close dialog" icon={X} onClick={onClose} className="-mr-2 -mt-1" />
        </div>
        <div ref={contentRef} className="overflow-y-auto px-5 pb-5 sm:px-6">{children}</div>
        {footer && (
          <div data-modal-footer className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50/60 px-5 py-4 sm:flex-row sm:justify-end sm:px-6 dark:border-slate-800 dark:bg-slate-900/60">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
