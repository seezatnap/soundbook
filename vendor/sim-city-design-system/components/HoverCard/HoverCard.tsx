/*
 * A tooltip that grew a filing cabinet: rich preview content on a raised
 * Panel, for peeking at a record without opening it.
 *
 * Opens after 300ms of hover and closes after a 200ms grace, so the pointer
 * can cross the gap onto the card without dropping it — entering the card
 * cancels the close timer. Keyboard focus on the trigger opens it at once;
 * blur, Escape and outside clicks put it away. The card itself is real
 * content and stays clickable, unlike the Tooltip plate.
 */

import { Children, cloneElement, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { JSX, ReactElement, ReactNode } from 'react';
import { Panel } from '../Panel';
import { Portal, useAnchorPosition, useDismissable } from '../../lib/overlays';
import type { Placement } from '../../lib/overlays';
import './HoverCard.css';

export interface HoverCardProps {
  content: ReactNode;
  /** Optional striped title band on the card. */
  title?: ReactNode;
  placement?: Placement;
  /** ms of hover before opening. */
  openDelay?: number;
  /** ms of grace after pointerleave before closing. */
  closeDelay?: number;
  /** Exactly one element; it receives the hover/focus wiring. */
  children: ReactElement;
}

function chain<E>(theirs: unknown, ours: (event: E) => void): (event: E) => void {
  return (event: E) => {
    if (typeof theirs === 'function') (theirs as (event: E) => void)(event);
    ours(event);
  };
}

export function HoverCard({
  content,
  title,
  placement = 'bottom-start',
  openDelay = 300,
  closeDelay = 200,
  children,
}: HoverCardProps): JSX.Element {
  const [visible, setVisible] = useState(false);
  const anchorRef = useRef<HTMLElement | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const timerRef = useRef<number | null>(null);

  const cancel = useCallback((): void => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);
  const scheduleOpen = useCallback((): void => {
    cancel();
    timerRef.current = window.setTimeout(() => setVisible(true), openDelay);
  }, [cancel, openDelay]);
  const scheduleClose = useCallback((): void => {
    cancel();
    timerRef.current = window.setTimeout(() => setVisible(false), closeDelay);
  }, [cancel, closeDelay]);
  const hide = useCallback((): void => {
    cancel();
    setVisible(false);
  }, [cancel]);

  useEffect(() => cancel, [cancel]);

  const position = useAnchorPosition(anchorRef, cardRef, visible, placement, 6);
  const inside = useMemo(() => [cardRef, anchorRef], []);
  useDismissable({ onDismiss: hide, inside, enabled: visible });

  const child = Children.only(children);
  const props = child.props as Record<string, unknown>;
  const theirRef = props.ref as
    | ((node: HTMLElement | null) => void)
    | { current: HTMLElement | null }
    | null
    | undefined;

  const anchor = cloneElement(child as ReactElement<Record<string, unknown>>, {
    ref: (node: HTMLElement | null) => {
      anchorRef.current = node;
      if (typeof theirRef === 'function') theirRef(node);
      else if (theirRef) theirRef.current = node;
    },
    onPointerEnter: chain(props.onPointerEnter, scheduleOpen),
    onPointerLeave: chain(props.onPointerLeave, scheduleClose),
    onFocus: chain(props.onFocus, (event: { target: Element }) => {
      if (event.target.matches(':focus-visible')) {
        cancel();
        setVisible(true);
      }
    }),
    onBlur: chain(props.onBlur, hide),
    onKeyDown: chain(props.onKeyDown, (event: { key: string; stopPropagation: () => void }) => {
      if (event.key === 'Escape' && visible) {
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
            className="sc-hovercard"
            ref={cardRef}
            style={{
              top: position?.top ?? 0,
              left: position?.left ?? 0,
              visibility: position ? undefined : 'hidden',
            }}
            // Crossing onto the card is the whole point of the grace period.
            onPointerEnter={cancel}
            onPointerLeave={scheduleClose}
          >
            <Panel title={title} striped={title !== undefined}>
              {content}
            </Panel>
          </div>
        </Portal>
      )}
    </>
  );
}
