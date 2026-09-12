import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Modal from './Modal';

function renderModal(props = {}) {
  const onClose = vi.fn();
  const utils = render(
    <>
      <button type="button">Opener</button>
      <Modal open onClose={onClose} title="Edit thing" description="Some context" {...props}>
        <input aria-label="First" />
        <input aria-label="Second" />
      </Modal>
    </>
  );
  return { onClose, ...utils };
}

describe('Modal', () => {
  it('renders nothing when closed', () => {
    render(
      <Modal open={false} onClose={() => {}} title="Hidden">
        <p>body</p>
      </Modal>
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens as a labelled modal dialog portalled to body and locks page scroll', () => {
    renderModal();
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleName('Edit thing');
    expect(dialog).toHaveAccessibleDescription('Some context');
    expect(dialog.parentElement.parentElement).toBe(document.body);
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('moves focus into the dialog on open and back to the opener on close', async () => {
    const opener = document.createElement('button');
    opener.textContent = 'Outside';
    document.body.appendChild(opener);
    opener.focus();

    const { unmount } = renderModal();
    await waitFor(() => expect(screen.getByLabelText('First')).toHaveFocus());

    unmount();
    expect(opener).toHaveFocus();
    expect(document.body.style.overflow).toBe('');
    opener.remove();
  });

  it('honours initialFocusRef', async () => {
    const ref = { current: null };
    render(
      <Modal open onClose={() => {}} title="T" initialFocusRef={ref}>
        <input aria-label="A" />
        <input aria-label="B" ref={ref} />
      </Modal>
    );
    await waitFor(() => expect(screen.getByLabelText('B')).toHaveFocus());
  });

  it('closes on Escape', async () => {
    const { onClose } = renderModal();
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes via the close button and the backdrop, but not when closeOnBackdrop is false', async () => {
    const { onClose, unmount } = renderModal();
    await userEvent.click(screen.getByRole('button', { name: /close dialog/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole('presentation').firstChild);
    expect(onClose).toHaveBeenCalledTimes(2);
    unmount();

    const second = renderModal({ closeOnBackdrop: false });
    await userEvent.click(screen.getByRole('presentation').firstChild);
    expect(second.onClose).not.toHaveBeenCalled();
  });

  it('traps Tab focus inside the dialog', async () => {
    renderModal();
    // DOM order inside the panel: [Close dialog] [First] [Second].
    await waitFor(() => expect(screen.getByLabelText('First')).toHaveFocus());
    await userEvent.tab();
    expect(screen.getByLabelText('Second')).toHaveFocus();
    await userEvent.tab(); // past the last → wraps to the first focusable
    expect(screen.getByRole('button', { name: /close dialog/i })).toHaveFocus();
    await userEvent.tab({ shift: true }); // before the first → wraps to the last
    expect(screen.getByLabelText('Second')).toHaveFocus();
    await userEvent.tab({ shift: true });
    expect(screen.getByLabelText('First')).toHaveFocus();
    // Focus never leaves the dialog for the opener outside it.
    expect(screen.getByRole('button', { name: 'Opener' })).not.toHaveFocus();
  });

  it('renders the footer slot', () => {
    renderModal({ footer: <button type="button">Save</button> });
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });
});
