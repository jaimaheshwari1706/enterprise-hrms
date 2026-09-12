import { AlertTriangle, Info } from 'lucide-react';
import Modal from './Modal';
import Button from './Button';

// Yes/no prompt for destructive or irreversible actions. `tone='danger'`
// renders the confirm button red and a warning glyph; anything else is a
// neutral confirmation.
export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  loading = false,
  tone = 'danger',
  children,
}) {
  const Icon = tone === 'danger' ? AlertTriangle : Info;
  return (
    <Modal
      open={open}
      onClose={loading ? undefined : onClose}
      title={title}
      size="sm"
      closeOnBackdrop={!loading}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex gap-3">
        <div
          className={
            tone === 'danger'
              ? 'flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400'
              : 'flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-600 dark:bg-primary-500/10 dark:text-primary-300'
          }
        >
          <Icon size={18} aria-hidden="true" />
        </div>
        <div className="text-sm text-slate-600 dark:text-slate-300">
          {message && <p>{message}</p>}
          {children}
        </div>
      </div>
    </Modal>
  );
}
