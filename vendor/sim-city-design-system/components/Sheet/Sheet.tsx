/*
 * Edge-anchored modal drawer: an inspector that slides in flush against one
 * edge of the screen, over the same hard-checker scrim as Dialog, with the
 * same trap/dismiss/scroll-lock discipline.
 *
 * The entrance is a three-frame steps() slide — the sheet lands in three
 * hard jumps, the way a 1993 window manager would draw it. Nothing eases.
 */

import { useCallback, useEffect, useId, useMemo, useRef } from 'react';
import type { JSX, ReactNode } from 'react';
import { Panel } from '../Panel';
import { cx } from '../../lib/cx';
import { Portal, useDismissable, useFocusTrap } from '../../lib/overlays';
import { useControllableState } from '../../lib/useControllableState';
import './Sheet.css';

export interface SheetProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Which edge the drawer is flush against. */
  side?: 'right' | 'left' | 'bottom';
  /** Labels the sheet; rendered on the striped title band. */
  title: ReactNode;
  /** When false a scrim click does nothing; Escape still closes. */
  dismissable?: boolean;
  /** Right-aligned button row under the body. */
  footer?: ReactNode;
  children: ReactNode;
}

export function Sheet({
  open,
  defaultOpen,
  onOpenChange,
  side = 'right',
  title,
  dismissable = true,
  footer,
  children,
}: SheetProps): JSX.Element | null {
  const [isOpen, setOpen] = useControllableState(open, defaultOpen ?? false, onOpenChange);
  const sheetRef = useRef<HTMLDivElement>(null);
  // As in Dialog: the shared hook only handles Escape — the whole document is
  // "inside" — and the scrim itself judges outside clicks, so sibling portals
  // (toasts, popovers) never count as outside.
  const bodyRef = useRef<HTMLElement | null>(null);
  if (bodyRef.current === null) bodyRef.current = document.body;
  const titleId = useId();

  const close = useCallback(() => setOpen(false), [setOpen]);

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
  useFocusTrap(sheetRef, isOpen);

  if (!isOpen) return null;

  return (
    <Portal>
      <div
        className="sc-sheet__scrim"
        onPointerDown={(event) => {
          if (dismissable && event.target === event.currentTarget) close();
        }}
      >
        <div
          className={cx('sc-sheet', `sc-sheet--${side}`)}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          ref={sheetRef}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.stopPropagation();
              close();
            }
          }}
        >
          <Panel
            className="sc-sheet__panel"
            title={<span id={titleId}>{title}</span>}
            striped
            onClose={close}
          >
            {children}
            {footer !== undefined && <div className="sc-sheet__footer">{footer}</div>}
          </Panel>
        </div>
      </div>
    </Portal>
  );
}
