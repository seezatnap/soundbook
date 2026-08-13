/*
 * Modal dialog: a Panel floating on the hard-checker scrim.
 *
 * The scrim dims the city the way a 256-colour display would — a 45-degree
 * 2px stripe checker, not a translucent wash. Focus is trapped while open and
 * restored to the opener on close; Escape always closes; a click on the scrim
 * closes only while `dismissable`. The page behind cannot scroll.
 *
 * Outside clicks are judged by the scrim itself (`target === currentTarget`),
 * not by DOM containment: sibling portals (popovers, toasts) float outside the
 * dialog subtree and a click on them must not count as "outside". Escape still
 * goes through the shared `useDismissable`, with `document.body` as the inside
 * boundary so its pointer branch never fires.
 */

import { useCallback, useEffect, useId, useMemo, useRef } from 'react';
import type { JSX, ReactNode, RefObject } from 'react';
import { Panel } from '../Panel';
import { cx } from '../../lib/cx';
import { Portal, useDismissable, useFocusTrap } from '../../lib/overlays';
import { useControllableState } from '../../lib/useControllableState';
import './Dialog.css';

export interface DialogProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Labels the dialog; rendered on the striped title band. */
  title: ReactNode;
  /** sm 360px, md 460px, lg 640px — always capped at 100vw - 32px. */
  size?: 'sm' | 'md' | 'lg';
  /** When false a scrim click does nothing; Escape still closes. */
  dismissable?: boolean;
  /** AlertDialog swaps this to "alertdialog"; everyone else leaves it alone. */
  role?: 'dialog' | 'alertdialog';
  /** Focused on open instead of the first focusable in the panel. */
  initialFocusRef?: RefObject<HTMLElement | null>;
  /** Alert dialogs hide the title-band × and offer only their actions. */
  showClose?: boolean;
  'aria-describedby'?: string;
  /** Right-aligned button row under the body. */
  footer?: ReactNode;
  children: ReactNode;
}

export function Dialog({
  open,
  defaultOpen,
  onOpenChange,
  title,
  size = 'md',
  dismissable = true,
  role = 'dialog',
  initialFocusRef,
  showClose = true,
  'aria-describedby': describedBy,
  footer,
  children,
}: DialogProps): JSX.Element | null {
  const [isOpen, setOpen] = useControllableState(open, defaultOpen ?? false, onOpenChange);
  const dialogRef = useRef<HTMLDivElement>(null);
  // The whole document counts as "inside", so the shared hook only ever
  // dismisses on Escape; pointer policy belongs to the scrim below.
  const bodyRef = useRef<HTMLElement | null>(null);
  if (bodyRef.current === null) bodyRef.current = document.body;
  const titleId = useId();

  const close = useCallback(() => setOpen(false), [setOpen]);

  // The city must not scroll under a modal decision.
  useEffect(() => {
    if (!isOpen) return;
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = 'hidden';
    return () => {
      root.style.overflow = previous;
    };
  }, [isOpen]);

  const inside = useMemo(() => [bodyRef], []);
  useDismissable({ onDismiss: close, inside, enabled: isOpen });
  useFocusTrap(dialogRef, isOpen, initialFocusRef);

  if (!isOpen) return null;

  return (
    <Portal>
      <div
        className="sc-dialog__scrim"
        onPointerDown={(event) => {
          if (dismissable && event.target === event.currentTarget) close();
        }}
      >
        <div
          className={cx('sc-dialog', `sc-dialog--${size}`)}
          role={role}
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={describedBy}
          ref={dialogRef}
          onKeyDown={(event) => {
            // Escape closes only this, topmost layer; stop it here so an
            // overlay underneath does not also hear it at the document.
            if (event.key === 'Escape') {
              event.stopPropagation();
              close();
            }
          }}
        >
          <Panel
            title={<span id={titleId}>{title}</span>}
            striped
            onClose={showClose ? close : undefined}
          >
            {children}
            {footer !== undefined && <div className="sc-dialog__footer">{footer}</div>}
          </Panel>
        </div>
      </div>
    </Portal>
  );
}
