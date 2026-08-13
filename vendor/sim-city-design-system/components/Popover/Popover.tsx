/*
 * Non-modal anchored surface: a raised Panel pinned to its trigger.
 *
 * The trigger stays in the page and keeps focus when the popover opens —
 * focus only enters the surface when the user explicitly clicks or tabs into
 * it. Escape and outside clicks close it; Escape also returns focus to the
 * trigger, and is consumed so a modal underneath does not close in the same
 * keypress. Positioning, flipping and clamping come from useAnchorPosition.
 */

import { cloneElement, useCallback, useId, useMemo, useRef } from 'react';
import type { JSX, KeyboardEvent, ReactElement, ReactNode, Ref } from 'react';
import { Panel } from '../Panel';
import { Portal, useAnchorPosition, useDismissable } from '../../lib/overlays';
import type { Placement } from '../../lib/overlays';
import { useControllableState } from '../../lib/useControllableState';
import './Popover.css';

export interface PopoverTriggerProps {
  ref: Ref<HTMLElement>;
  onClick: (event: unknown) => void;
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
  'aria-expanded': boolean;
  'aria-haspopup': 'dialog';
}

export interface PopoverProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  placement?: Placement;
  /** Whole pixels between anchor and surface. */
  gap?: number;
  /** Optional striped title band on the surface. */
  title?: ReactNode;
  /**
   * The anchor: an element cloned with trigger props (ref, onClick,
   * aria-expanded, aria-haspopup), or a render prop receiving them.
   */
  trigger: ReactElement | ((props: PopoverTriggerProps) => ReactNode);
  children: ReactNode;
}

export function Popover({
  open,
  defaultOpen,
  onOpenChange,
  placement = 'bottom-start',
  gap = 2,
  title,
  trigger,
  children,
}: PopoverProps): JSX.Element {
  const [isOpen, setOpen] = useControllableState(open, defaultOpen ?? false, onOpenChange);
  const anchorRef = useRef<HTMLElement | null>(null);
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const titleId = useId();

  const close = useCallback(() => setOpen(false), [setOpen]);
  const closeAndRefocus = useCallback(() => {
    setOpen(false);
    anchorRef.current?.focus();
  }, [setOpen]);

  const inside = useMemo(() => [surfaceRef, anchorRef], []);
  useDismissable({ onDismiss: close, inside, enabled: isOpen });

  const position = useAnchorPosition(anchorRef, surfaceRef, isOpen, placement, gap);

  const triggerProps: PopoverTriggerProps = {
    ref: (node: HTMLElement | null) => {
      anchorRef.current = node;
    },
    onClick: () => setOpen(!isOpen),
    onKeyDown: (event) => {
      // Escape on the trigger closes the popover and nothing else.
      if (event.key === 'Escape' && isOpen) {
        event.stopPropagation();
        close();
      }
    },
    'aria-expanded': isOpen,
    'aria-haspopup': 'dialog',
  };

  let anchor: ReactNode;
  if (typeof trigger === 'function') {
    anchor = trigger(triggerProps);
  } else {
    const theirProps = trigger.props as Record<string, unknown>;
    const theirClick = theirProps.onClick as ((event: unknown) => void) | undefined;
    const theirKeyDown = theirProps.onKeyDown as
      | ((event: KeyboardEvent<HTMLElement>) => void)
      | undefined;
    const theirRef = theirProps.ref as
      | ((node: HTMLElement | null) => void)
      | { current: HTMLElement | null }
      | null
      | undefined;
    anchor = cloneElement(trigger as ReactElement<Record<string, unknown>>, {
      ...triggerProps,
      ref: (node: HTMLElement | null) => {
        anchorRef.current = node;
        if (typeof theirRef === 'function') theirRef(node);
        else if (theirRef) theirRef.current = node;
      },
      onClick: (event: unknown) => {
        theirClick?.(event);
        triggerProps.onClick(event);
      },
      onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
        theirKeyDown?.(event);
        triggerProps.onKeyDown(event);
      },
    });
  }

  return (
    <>
      {anchor}
      {isOpen && (
        <Portal>
          <div
            className="sc-popover"
            role="dialog"
            aria-labelledby={title !== undefined ? titleId : undefined}
            ref={surfaceRef}
            style={{
              top: position?.top ?? 0,
              left: position?.left ?? 0,
              visibility: position ? undefined : 'hidden',
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.stopPropagation();
                closeAndRefocus();
              }
            }}
          >
            <Panel
              title={title !== undefined ? <span id={titleId}>{title}</span> : undefined}
              striped
            >
              {children}
            </Panel>
          </div>
        </Portal>
      )}
    </>
  );
}
