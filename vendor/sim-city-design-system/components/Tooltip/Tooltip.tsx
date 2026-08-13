/*
 * A read-only plate that names the thing under the pointer.
 *
 * It appears after a 400ms hover (immediately on keyboard focus, which is
 * already a deliberate act), and vanishes on Escape, blur, pointerleave or
 * any click. It is never interactive: pointer-events are off, focus never
 * enters it, and it speaks only through aria-describedby on its one child.
 */

import { Children, cloneElement, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { JSX, ReactElement, ReactNode, RefObject } from 'react';
import { cx } from '../../lib/cx';
import { Portal, useAnchorPosition, useDismissable } from '../../lib/overlays';
import type { Placement } from '../../lib/overlays';
import './Tooltip.css';

export interface TooltipProps {
  content: ReactNode;
  placement?: Placement;
  /** ms of hover before showing. Keyboard focus skips the wait. */
  delay?: number;
  /** Exactly one element; it receives the hover/focus wiring. */
  children: ReactElement;
}

function chain<E>(theirs: unknown, ours: (event: E) => void): (event: E) => void {
  return (event: E) => {
    if (typeof theirs === 'function') (theirs as (event: E) => void)(event);
    ours(event);
  };
}

export function Tooltip({
  content,
  placement = 'top-start',
  delay = 400,
  children,
}: TooltipProps): JSX.Element {
  const [visible, setVisible] = useState(false);
  const anchorRef = useRef<HTMLElement | null>(null);
  const plateRef = useRef<HTMLDivElement | null>(null);
  const timerRef = useRef<number | null>(null);
  const id = useId();

  const cancel = useCallback((): void => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);
  const hide = useCallback((): void => {
    cancel();
    setVisible(false);
  }, [cancel]);

  useEffect(() => cancel, [cancel]);

  const position = useAnchorPosition(anchorRef, plateRef, visible, placement, 6);
  // No refs count as inside: any pointerdown anywhere hides the plate.
  const inside = useMemo<Array<RefObject<HTMLElement | null>>>(() => [], []);
  useDismissable({ onDismiss: hide, inside, enabled: visible });

  const child = Children.only(children);
  const props = child.props as Record<string, unknown>;
  const theirRef = props.ref as
    | ((node: HTMLElement | null) => void)
    | RefObject<HTMLElement | null>
    | null
    | undefined;

  const anchor = cloneElement(child as ReactElement<Record<string, unknown>>, {
    ref: (node: HTMLElement | null) => {
      anchorRef.current = node;
      if (typeof theirRef === 'function') theirRef(node);
      else if (theirRef) theirRef.current = node;
    },
    'aria-describedby':
      cx(props['aria-describedby'] as string | undefined, visible ? id : undefined) || undefined,
    onPointerEnter: chain(props.onPointerEnter, () => {
      cancel();
      timerRef.current = window.setTimeout(() => setVisible(true), delay);
    }),
    onPointerLeave: chain(props.onPointerLeave, hide),
    onFocus: chain(props.onFocus, (event: { target: Element }) => {
      // Keyboard focus shows immediately; pointer-made focus is left to the
      // hover timer so a click does not double-announce.
      if (event.target.matches(':focus-visible')) {
        cancel();
        setVisible(true);
      }
    }),
    onBlur: chain(props.onBlur, hide),
    onKeyDown: chain(props.onKeyDown, (event: { key: string; stopPropagation: () => void }) => {
      if (event.key === 'Escape' && visible) {
        // The plate consumes its own Escape; a dialog underneath keeps its.
        event.stopPropagation();
        hide();
      }
    }),
  });

  return (
    <>
      {anchor}
      {visible && (
        <Portal>
          <div
            className="sc-tooltip"
            role="tooltip"
            id={id}
            ref={plateRef}
            style={{
              top: position?.top ?? 0,
              left: position?.left ?? 0,
              visibility: position ? undefined : 'hidden',
            }}
          >
            {content}
          </div>
        </Portal>
      )}
    </>
  );
}
