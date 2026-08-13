/*
 * A menu at the pointer. The surface wraps an area; right-click opens the
 * menu at the click point via a zero-size virtual anchor, and Shift+F10 or
 * the Menu key opens it beneath whatever has focus. The overlay is keyed by
 * its point so each summons re-measures and re-positions from scratch —
 * nothing animates, the menu is simply there.
 */

import { useCallback, useRef, useState } from 'react';
import type {
  HTMLAttributes,
  JSX,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  ReactNode,
} from 'react';
import { cx } from '../../lib/cx';
import { MenuPanel, MenuRoot } from '../Menu';
import { Portal, useAnchorPosition, useDismissable } from '../../lib/overlays';
import './ContextMenu.css';

export interface ContextMenuProps extends HTMLAttributes<HTMLDivElement> {
  /** Menu entries: MenuItem, MenuCheckboxItem, MenuSub… */
  menu: ReactNode;
  /** Accessible name for the menu. */
  menuLabel?: string;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
}

interface OverlayProps {
  point: { x: number; y: number };
  mode: 'first' | 'panel';
  menuLabel: string;
  close: (restoreFocus: boolean) => void;
  children: ReactNode;
}

function ContextMenuOverlay({ point, mode, menuLabel, close, children }: OverlayProps): JSX.Element {
  const anchorRef = useRef<HTMLSpanElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const position = useAnchorPosition(anchorRef, panelRef, true, 'bottom-start', 0);

  useDismissable({
    onDismiss: () => close(false),
    inside: [panelRef],
    enabled: true,
  });

  return (
    <Portal>
      <span
        ref={anchorRef}
        className="sc-contextmenu__anchor"
        style={{ top: point.y, left: point.x }}
        aria-hidden="true"
      />
      <MenuPanel
        ref={panelRef}
        aria-label={menuLabel}
        focusOnMount={mode}
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
  );
}

export function ContextMenu({
  menu,
  menuLabel = 'Context menu',
  onOpenChange,
  className,
  children,
  onContextMenu,
  onKeyDown,
  ...rest
}: ContextMenuProps): JSX.Element {
  const [point, setPoint] = useState<{ x: number; y: number } | null>(null);
  const modeRef = useRef<'first' | 'panel'>('panel');
  const previousFocus = useRef<HTMLElement | null>(null);

  const openAt = (x: number, y: number, mode: 'first' | 'panel'): void => {
    // Whatever held focus gets it back on Escape. If focus already fell to
    // <body> (the menu was just dismissed mid-reopen), keep the older target.
    const active = document.activeElement as HTMLElement | null;
    if (active && active !== document.body) previousFocus.current = active;
    modeRef.current = mode;
    setPoint({ x, y });
    onOpenChange?.(true);
  };

  const close = useCallback(
    (restoreFocus: boolean): void => {
      setPoint(null);
      onOpenChange?.(false);
      if (restoreFocus) previousFocus.current?.focus();
    },
    [onOpenChange],
  );

  const handleContextMenu = (event: ReactMouseEvent<HTMLDivElement>): void => {
    onContextMenu?.(event);
    if (event.defaultPrevented) return;
    event.preventDefault();
    openAt(event.clientX, event.clientY, 'panel');
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>): void => {
    onKeyDown?.(event);
    if (event.defaultPrevented) return;
    if ((event.key === 'F10' && event.shiftKey) || event.key === 'ContextMenu') {
      event.preventDefault();
      const rect = (event.target as HTMLElement).getBoundingClientRect();
      openAt(rect.left, rect.bottom, 'first');
    }
  };

  return (
    <div
      {...rest}
      className={cx('sc-contextmenu', className)}
      onContextMenu={handleContextMenu}
      onKeyDown={handleKeyDown}
    >
      {children}
      {point ? (
        <MenuRoot onCloseAll={close}>
          <ContextMenuOverlay
            key={`${point.x},${point.y}`}
            point={point}
            mode={modeRef.current}
            menuLabel={menuLabel}
            close={close}
          >
            {menu}
          </ContextMenuOverlay>
        </MenuRoot>
      ) : null}
    </div>
  );
}
