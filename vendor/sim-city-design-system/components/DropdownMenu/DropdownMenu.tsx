/*
 * A menu on a trigger. The trigger is a house Button by default, or anything
 * the caller renders through the `trigger` render prop — the aria wiring and
 * handlers are handed over, and a thin inline wrapper span carries the anchor
 * measurement so no ref has to be threaded into foreign components.
 *
 * Opens on click (focus rests on the panel), or on ArrowDown/ArrowUp straight
 * onto the first/last row. The panel portals to <body> and pins bottom-start
 * via useAnchorPosition, flipping when the viewport runs out.
 */

import { useCallback, useRef } from 'react';
import type {
  JSX,
  KeyboardEvent as ReactKeyboardEvent,
  KeyboardEventHandler,
  MouseEventHandler,
  ReactNode,
} from 'react';
import { Button } from '../Button';
import { MenuPanel, MenuRoot } from '../Menu';
import { PixelIcon, type PixelIconName } from '../../icons/PixelIcon';
import { Portal, useAnchorPosition, useDismissable, type Placement } from '../../lib/overlays';
import { useControllableState } from '../../lib/useControllableState';
import './DropdownMenu.css';

export interface DropdownTriggerProps {
  'aria-haspopup': 'menu';
  'aria-expanded': boolean;
  onClick: MouseEventHandler<HTMLElement>;
  onKeyDown: KeyboardEventHandler<HTMLElement>;
}

export interface DropdownMenuProps {
  /** Label for the default Button trigger; ignored when `trigger` is given. */
  label?: ReactNode;
  icon?: PixelIconName;
  /** Render your own trigger; spread the given props onto the real control. */
  trigger?: (props: DropdownTriggerProps) => ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  placement?: Placement;
  /** Accessible name for the menu itself. */
  menuLabel?: string;
  /** Menu entries: MenuItem, MenuCheckboxItem, MenuRadioGroup, MenuSub… */
  children: ReactNode;
}

const TRIGGER_FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]';

export function DropdownMenu({
  label,
  icon,
  trigger,
  open: openProp,
  defaultOpen,
  onOpenChange,
  placement = 'bottom-start',
  menuLabel,
  children,
}: DropdownMenuProps): JSX.Element {
  const [open, setOpen] = useControllableState(openProp, defaultOpen ?? false, onOpenChange);
  const anchorRef = useRef<HTMLSpanElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const modeRef = useRef<'first' | 'last' | 'panel'>('panel');
  const position = useAnchorPosition(anchorRef, panelRef, open, placement);

  const closeAll = useCallback(
    (restoreFocus: boolean): void => {
      setOpen(false);
      if (restoreFocus) anchorRef.current?.querySelector<HTMLElement>(TRIGGER_FOCUSABLE)?.focus();
    },
    [setOpen],
  );

  useDismissable({
    onDismiss: () => setOpen(false),
    inside: [anchorRef, panelRef],
    enabled: open,
  });

  const openWith = (mode: 'first' | 'last' | 'panel'): void => {
    modeRef.current = mode;
    setOpen(true);
  };

  const triggerProps: DropdownTriggerProps = {
    'aria-haspopup': 'menu',
    'aria-expanded': open,
    onClick: () => {
      if (open) closeAll(true);
      else openWith('panel');
    },
    onKeyDown: (event: ReactKeyboardEvent<HTMLElement>) => {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        openWith('first');
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        openWith('last');
      }
    },
  };

  return (
    <MenuRoot onCloseAll={closeAll}>
      <span className="sc-dropdown" ref={anchorRef}>
        {trigger ? (
          trigger(triggerProps)
        ) : (
          <Button {...triggerProps} icon={icon}>
            {label}
            <PixelIcon name="chevron-down" size={16} />
          </Button>
        )}
      </span>
      {open ? (
        <Portal>
          <MenuPanel
            ref={panelRef}
            aria-label={menuLabel ?? (typeof label === 'string' ? label : undefined)}
            focusOnMount={modeRef.current}
            className="sc-menu__panel--floating"
            style={{
              top: position?.top ?? -9999,
              left: position?.left ?? -9999,
              visibility: position ? undefined : 'hidden',
            }}
          >
            {children}
          </MenuPanel>
        </Portal>
      ) : null}
    </MenuRoot>
  );
}
