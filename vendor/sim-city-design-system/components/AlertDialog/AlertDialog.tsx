/*
 * The dialog for decisions that spend money or destroy committed work.
 *
 * A Dialog wearing role="alertdialog": the scrim never dismisses it, the
 * title-band × is gone, and the only ways out are the two actions (Escape
 * counts as cancel). Focus lands on the least-destructive button, so the
 * fastest possible keypress is the safe one. When `destructive`, the
 * description wears the hatched warn band and the confirm goes danger.
 */

import { useId, useRef } from 'react';
import type { JSX, ReactNode } from 'react';
import { Button } from '../Button';
import { Dialog } from '../Dialog';
import { cx } from '../../lib/cx';
import { useControllableState } from '../../lib/useControllableState';
import './AlertDialog.css';

export interface AlertDialogProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  title: ReactNode;
  /** The stakes, stated plainly. Doubles as the aria description. */
  description: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  /** Hatched warn band on the description and a danger confirm. */
  destructive?: boolean;
}

export function AlertDialog({
  open,
  defaultOpen,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  destructive = false,
}: AlertDialogProps): JSX.Element {
  const [isOpen, setOpen] = useControllableState(open, defaultOpen ?? false, onOpenChange);
  const cancelRef = useRef<HTMLElement | null>(null);
  const descId = useId();

  const cancel = (): void => {
    onCancel?.();
    setOpen(false);
  };
  const confirm = (): void => {
    onConfirm?.();
    setOpen(false);
  };

  return (
    <Dialog
      open={isOpen}
      // Every close that goes through Dialog itself (Escape) is a cancel;
      // confirm bypasses this by setting our own state directly.
      onOpenChange={(next) => {
        if (!next) cancel();
      }}
      title={title}
      size="sm"
      role="alertdialog"
      dismissable={false}
      showClose={false}
      initialFocusRef={cancelRef}
      aria-describedby={descId}
      footer={
        <>
          {/* Button owns its element; the display:contents shim only exists to
              hand the trap a ref to the least-destructive way out. */}
          <span
            style={{ display: 'contents' }}
            ref={(node) => {
              cancelRef.current = node?.querySelector('button') ?? null;
            }}
          >
            <Button onClick={cancel}>{cancelLabel}</Button>
          </span>
          <Button variant={destructive ? 'danger' : 'accent'} onClick={confirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p
        id={descId}
        className={cx('sc-alertdialog__desc', destructive && 'sc-alertdialog__desc--warn')}
      >
        {description}
      </p>
    </Dialog>
  );
}
