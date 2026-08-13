/*
 * Classic pull-down menu bar, generalised from the infinimap original.
 *
 * Behaviour follows the desktop convention the look implies, because a menu
 * bar that looks like 1993 but does not respond to the keyboard is a costume:
 * titles carry a roving tabindex, ArrowLeft/Right walk them (wrapping, and
 * carrying an open menu along), ArrowDown/Enter/Space open onto the first row
 * and ArrowUp onto the last, Escape closes and restores the title, and once
 * one menu is open, hovering a sibling title opens that one instead — the
 * detail that makes a menu bar feel real. The panels themselves are the
 * shared Menu internals; the open title takes the sunken pressed bevel.
 */

import { useCallback, useRef, useState } from 'react';
import type { JSX, KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react';
import {
  MenuCheckboxItem,
  MenuItem,
  MenuPanel,
  MenuRoot,
  MenuSeparator,
  focusMenuItem,
} from '../Menu';
import { useDismissable } from '../../lib/overlays';
import './MenuBar.css';

export interface MenuItemDef {
  id: string;
  label: string;
  /** Right-aligned shortcut hint. */
  hint?: string;
  /** Present (true or false) makes the row a menuitemcheckbox. */
  checked?: boolean;
  disabled?: boolean;
  onSelect?: () => void;
}

export interface MenuSeparatorDef {
  id: string;
  separator: true;
}

export type MenuEntry = MenuItemDef | MenuSeparatorDef;

export interface MenuDef {
  id: string;
  label: string;
  entries: MenuEntry[];
}

function isSeparatorEntry(entry: MenuEntry): entry is MenuSeparatorDef {
  return (entry as MenuSeparatorDef).separator === true;
}

export interface MenuBarProps {
  menus: MenuDef[];
  brand?: ReactNode;
  aside?: ReactNode;
  'aria-label'?: string;
}

export function MenuBar({ menus, brand, aside, 'aria-label': ariaLabel = 'Main' }: MenuBarProps): JSX.Element {
  const [openId, setOpenId] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(menus[0]?.id ?? null);
  const [mode, setMode] = useState<'first' | 'last' | 'none'>('none');
  const rootRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const titleRefs = useRef(new Map<string, HTMLButtonElement>());

  const close = useCallback(
    (restoreFocus: boolean): void => {
      if (openId === null) return;
      setOpenId(null);
      if (restoreFocus) {
        setFocusId(openId);
        titleRefs.current.get(openId)?.focus();
      }
    },
    [openId],
  );

  const open = (id: string, focus: 'first' | 'last' | 'none'): void => {
    setMode(focus);
    setOpenId(id);
    setFocusId(id);
  };

  useDismissable({
    onDismiss: () => close(false),
    inside: [rootRef],
    enabled: openId !== null,
  });

  const moveTitle = (delta: number): void => {
    if (menus.length === 0) return;
    const currentId = openId ?? focusId ?? menus[0].id;
    const index = menus.findIndex((menu) => menu.id === currentId);
    const next = menus[(index + delta + menus.length) % menus.length];
    if (openId !== null) open(next.id, 'none');
    else setFocusId(next.id);
    titleRefs.current.get(next.id)?.focus();
  };

  const edgeTitle = (which: 'first' | 'last'): void => {
    const target = which === 'first' ? menus[0] : menus[menus.length - 1];
    if (!target) return;
    if (openId !== null && openId !== target.id) open(target.id, 'none');
    else setFocusId(target.id);
    titleRefs.current.get(target.id)?.focus();
  };

  const titleKeyDown = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
    id: string,
    expanded: boolean,
  ): void => {
    switch (event.key) {
      case 'ArrowDown':
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (expanded) focusMenuItem(panelRef.current, 'first');
        else open(id, 'first');
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (expanded) focusMenuItem(panelRef.current, 'last');
        else open(id, 'last');
        break;
      case 'ArrowRight':
        event.preventDefault();
        event.stopPropagation();
        moveTitle(1);
        break;
      case 'ArrowLeft':
        event.preventDefault();
        event.stopPropagation();
        moveTitle(-1);
        break;
      case 'Home':
        event.preventDefault();
        edgeTitle('first');
        break;
      case 'End':
        event.preventDefault();
        edgeTitle('last');
        break;
      case 'Escape':
        if (expanded) {
          event.preventDefault();
          event.stopPropagation();
          close(true);
        }
        break;
    }
  };

  // Unhandled ArrowLeft/Right bubble out of the open panel: carry the open
  // menu to the neighbouring title, exactly as if the title had the focus.
  const barKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>): void => {
    if (!panelRef.current?.contains(event.target as Node)) return;
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      moveTitle(1);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      moveTitle(-1);
    }
  };

  const renderEntry = (entry: MenuEntry): JSX.Element =>
    isSeparatorEntry(entry) ? (
      <MenuSeparator key={entry.id} />
    ) : entry.checked !== undefined ? (
      <MenuCheckboxItem
        key={entry.id}
        checked={entry.checked}
        hint={entry.hint}
        disabled={entry.disabled}
        onSelect={entry.onSelect}
      >
        {entry.label}
      </MenuCheckboxItem>
    ) : (
      <MenuItem key={entry.id} hint={entry.hint} disabled={entry.disabled} onSelect={entry.onSelect}>
        {entry.label}
      </MenuItem>
    );

  const rovingId = focusId ?? menus[0]?.id;

  return (
    <div
      className="sc-menubar"
      role="menubar"
      aria-label={ariaLabel}
      ref={rootRef}
      onKeyDown={barKeyDown}
    >
      {brand ? <div className="sc-menubar__brand">{brand}</div> : null}
      {menus.map((menu) => {
        const expanded = openId === menu.id;
        return (
          <div className="sc-menubar__menu" key={menu.id}>
            <button
              type="button"
              role="menuitem"
              className="sc-menubar__title"
              aria-haspopup="menu"
              aria-expanded={expanded}
              tabIndex={menu.id === rovingId ? 0 : -1}
              ref={(node) => {
                if (node) titleRefs.current.set(menu.id, node);
                else titleRefs.current.delete(menu.id);
              }}
              onClick={() => {
                // Deliberately `click` rather than `pointerdown`: click is the
                // one activation every input method produces, and the outside
                // dismissal watches `pointerdown`, which fires first, so the
                // two never fight over the same press.
                if (expanded) close(true);
                else open(menu.id, 'none');
              }}
              onPointerEnter={() => {
                // Once one menu is open, sliding across the bar opens the rest.
                if (openId !== null && !expanded) {
                  open(menu.id, 'none');
                  titleRefs.current.get(menu.id)?.focus();
                }
              }}
              onFocus={() => setFocusId(menu.id)}
              onKeyDown={(event) => titleKeyDown(event, menu.id, expanded)}
            >
              {menu.label}
            </button>
            {expanded ? (
              <MenuRoot onCloseAll={close}>
                <MenuPanel
                  ref={panelRef}
                  className="sc-menubar__panel"
                  aria-label={menu.label}
                  focusOnMount={mode}
                >
                  {menu.entries.map(renderEntry)}
                </MenuPanel>
              </MenuRoot>
            ) : null}
          </div>
        );
      })}
      <div className="sc-menubar__spacer" />
      {aside ? <div className="sc-menubar__aside">{aside}</div> : null}
    </div>
  );
}
