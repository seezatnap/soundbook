/*
 * The menu internals, built once and worn by everything that pulls down,
 * pops up or drops out: DropdownMenu, ContextMenu, MenuBar.
 *
 * The look is a raised panel of uppercase rows with an amber highlight; the
 * behaviour is the APG menu pattern by hand. One deliberate trick throughout:
 * hovering a row *focuses* it, so focus alone drives the highlight and there
 * is never more than one lit row, whichever input method is steering.
 *
 * Submenu panels portal to <body> and position off their trigger row, which
 * keeps each panel's DOM containing only its own rows — keyboard navigation
 * is a querySelectorAll over the panel element, no registration plumbing.
 */

import {
  createContext,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import type {
  HTMLAttributes,
  JSX,
  KeyboardEvent as ReactKeyboardEvent,
  ReactNode,
  Ref,
  RefObject,
} from 'react';
import { cx } from '../../lib/cx';
import { PixelIcon, type PixelIconName } from '../../icons/PixelIcon';
import { Portal, useAnchorPosition } from '../../lib/overlays';
import { useControllableState } from '../../lib/useControllableState';
import './Menu.css';

/* --------------------------------------------------------------------------
 * Contexts. The root context is provided by whatever owns the whole tree
 * (dropdown trigger, context surface, menubar) and knows how to close it.
 * ------------------------------------------------------------------------ */

interface MenuRootValue {
  closeAll: (restoreFocus: boolean) => void;
}

const MenuRootContext = createContext<MenuRootValue>({ closeAll: () => {} });

export interface MenuRootProps {
  /** Close every level; `restoreFocus` asks for focus back on the opener. */
  onCloseAll: (restoreFocus: boolean) => void;
  children: ReactNode;
}

export function MenuRoot({ onCloseAll, children }: MenuRootProps): JSX.Element {
  const value = useMemo(() => ({ closeAll: onCloseAll }), [onCloseAll]);
  return <MenuRootContext.Provider value={value}>{children}</MenuRootContext.Provider>;
}

interface MenuPanelValue {
  openSubId: string | null;
  setOpenSub: (id: string | null) => void;
}

const MenuPanelContext = createContext<MenuPanelValue | null>(null);

/* --------------------------------------------------------------------------
 * Item collection. Disabled rows are real disabled buttons, so one selector
 * yields exactly the rows the arrows may land on, in DOM order.
 * ------------------------------------------------------------------------ */

const ITEM_SELECTOR = '.sc-menu__item:not(:disabled)';

export function menuItems(panel: HTMLElement): HTMLElement[] {
  return Array.from(panel.querySelectorAll<HTMLElement>(ITEM_SELECTOR));
}

export function focusMenuItem(panel: HTMLElement | null, which: 'first' | 'last'): void {
  if (!panel) return;
  const items = menuItems(panel);
  (which === 'first' ? items[0] : items[items.length - 1])?.focus();
}

/* --------------------------------------------------------------------------
 * MenuPanel
 * ------------------------------------------------------------------------ */

export interface MenuPanelProps extends HTMLAttributes<HTMLDivElement> {
  ref?: Ref<HTMLDivElement>;
  /** Where focus lands when the panel mounts; the opener decides. */
  focusOnMount?: 'first' | 'last' | 'panel' | 'none';
  /**
   * Set on submenu levels: Escape and ArrowLeft close this level only.
   * Root panels leave Escape to the root and let ArrowLeft bubble to a
   * menubar, which is how one keystroke walks sibling menus.
   */
  onLevelClose?: () => void;
  /** Overridable so a standalone panel in a story can join the tab order. */
  tabIndex?: number;
}

export function MenuPanel({
  ref,
  focusOnMount = 'none',
  onLevelClose,
  tabIndex = -1,
  className,
  children,
  onKeyDown,
  ...rest
}: MenuPanelProps): JSX.Element {
  const innerRef = useRef<HTMLDivElement | null>(null);
  const root = useContext(MenuRootContext);
  const [openSubId, setOpenSub] = useState<string | null>(null);
  const typeahead = useRef({ buffer: '', at: 0 });

  const setNode = (node: HTMLDivElement | null): void => {
    innerRef.current = node;
    if (typeof ref === 'function') ref(node);
    else if (ref) (ref as RefObject<HTMLDivElement | null>).current = node;
  };

  // Passive effect on purpose: floating owners position the panel in a layout
  // effect, and a still-hidden element cannot take focus.
  useEffect(() => {
    const panel = innerRef.current;
    if (!panel) return;
    if (focusOnMount === 'first' || focusOnMount === 'last') focusMenuItem(panel, focusOnMount);
    else if (focusOnMount === 'panel') panel.focus();
    // Mount only: the focus mode is a property of how the panel was opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>): void => {
    onKeyDown?.(event);
    const panel = innerRef.current;
    if (!panel) return;
    // Portalled submenus re-dispatch through the React tree; only answer for
    // keys born in this panel's own DOM.
    if (!panel.contains(event.target as Node)) return;

    const items = menuItems(panel);
    const active = document.activeElement as HTMLElement | null;
    const index = active ? items.indexOf(active) : -1;
    const take = (): void => {
      event.preventDefault();
      event.stopPropagation();
    };

    switch (event.key) {
      case 'ArrowDown':
        take();
        if (items.length) items[index < 0 ? 0 : (index + 1) % items.length].focus();
        break;
      case 'ArrowUp':
        take();
        if (items.length) items[index < 0 ? items.length - 1 : (index - 1 + items.length) % items.length].focus();
        break;
      case 'Home':
        take();
        items[0]?.focus();
        break;
      case 'End':
        take();
        items[items.length - 1]?.focus();
        break;
      case 'Escape':
        take();
        if (onLevelClose) onLevelClose();
        else root.closeAll(true);
        break;
      case 'ArrowLeft':
        if (onLevelClose) {
          take();
          onLevelClose();
        }
        break;
      case 'Tab':
        // APG: Tab abandons the menu. Let the browser carry focus onward.
        root.closeAll(false);
        break;
      case 'Enter':
      case ' ':
        // Rows are real buttons and activate themselves; just keep Space from
        // scrolling when the panel itself holds focus.
        if (event.target === panel) event.preventDefault();
        break;
      default: {
        if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
          event.stopPropagation();
          const now = Date.now();
          const t = typeahead.current;
          t.buffer = now - t.at > 600 ? event.key : t.buffer + event.key;
          t.at = now;
          const query = t.buffer.toLowerCase();
          const start = index < 0 ? 0 : query.length === 1 ? index + 1 : index;
          for (let step = 0; step < items.length; step++) {
            const el = items[(start + step) % items.length];
            const label = (el.dataset.label ?? el.textContent ?? '').trim().toLowerCase();
            if (label.startsWith(query)) {
              el.focus();
              break;
            }
          }
        }
      }
    }
  };

  const value = useMemo(() => ({ openSubId, setOpenSub }), [openSubId]);

  return (
    <MenuPanelContext.Provider value={value}>
      <div
        {...rest}
        ref={setNode}
        role="menu"
        tabIndex={tabIndex}
        className={cx('sc-menu__panel', className)}
        onKeyDown={handleKeyDown}
      >
        {children}
      </div>
    </MenuPanelContext.Provider>
  );
}

/* --------------------------------------------------------------------------
 * Rows. One private row shape wears three ARIA roles; the 16px lead column
 * is always reserved so labels align whether or not anything is checked.
 * ------------------------------------------------------------------------ */

interface MenuRowProps {
  role: 'menuitem' | 'menuitemcheckbox' | 'menuitemradio';
  checked?: boolean;
  lead?: ReactNode;
  label: ReactNode;
  hint?: string;
  disabled?: boolean;
  onActivate: () => void;
}

function MenuRow({ role, checked, lead, label, hint, disabled, onActivate }: MenuRowProps): JSX.Element {
  const panel = useContext(MenuPanelContext);
  return (
    <button
      type="button"
      role={role}
      className="sc-menu__item"
      disabled={disabled}
      tabIndex={-1}
      aria-checked={role === 'menuitem' ? undefined : checked === true}
      data-label={typeof label === 'string' ? label : undefined}
      onPointerEnter={(event) => {
        event.currentTarget.focus();
        panel?.setOpenSub(null);
      }}
      onClick={onActivate}
    >
      <span className="sc-menu__lead" aria-hidden="true">
        {lead}
      </span>
      <span className="sc-menu__label">{label}</span>
      {hint ? <span className="sc-menu__hint">{hint}</span> : null}
    </button>
  );
}

export interface MenuItemProps {
  children: ReactNode;
  icon?: PixelIconName;
  /** Right-aligned shortcut hint. */
  hint?: string;
  disabled?: boolean;
  onSelect?: () => void;
}

export function MenuItem({ children, icon, hint, disabled, onSelect }: MenuItemProps): JSX.Element {
  const root = useContext(MenuRootContext);
  return (
    <MenuRow
      role="menuitem"
      lead={icon ? <PixelIcon name={icon} size={16} /> : null}
      label={children}
      hint={hint}
      disabled={disabled}
      onActivate={() => {
        onSelect?.();
        root.closeAll(true);
      }}
    />
  );
}

export interface MenuCheckboxItemProps {
  children: ReactNode;
  hint?: string;
  disabled?: boolean;
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  onSelect?: () => void;
}

export function MenuCheckboxItem({
  children,
  hint,
  disabled,
  checked: checkedProp,
  defaultChecked,
  onCheckedChange,
  onSelect,
}: MenuCheckboxItemProps): JSX.Element {
  const root = useContext(MenuRootContext);
  const [checked, setChecked] = useControllableState(checkedProp, defaultChecked ?? false, onCheckedChange);
  return (
    <MenuRow
      role="menuitemcheckbox"
      checked={checked}
      lead={checked ? <PixelIcon name="check" size={16} /> : null}
      label={children}
      hint={hint}
      disabled={disabled}
      onActivate={() => {
        setChecked(!checked);
        onSelect?.();
        root.closeAll(true);
      }}
    />
  );
}

interface MenuRadioGroupValue {
  value: string;
  setValue: (value: string) => void;
}

const MenuRadioGroupContext = createContext<MenuRadioGroupValue | null>(null);

export interface MenuRadioGroupProps {
  children: ReactNode;
  'aria-label'?: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
}

export function MenuRadioGroup({
  children,
  'aria-label': ariaLabel,
  value: valueProp,
  defaultValue,
  onValueChange,
}: MenuRadioGroupProps): JSX.Element {
  const [value, setValue] = useControllableState(valueProp, defaultValue ?? '', onValueChange);
  const group = useMemo(() => ({ value, setValue }), [value, setValue]);
  return (
    <div role="group" aria-label={ariaLabel}>
      <MenuRadioGroupContext.Provider value={group}>{children}</MenuRadioGroupContext.Provider>
    </div>
  );
}

export interface MenuRadioItemProps {
  value: string;
  children: ReactNode;
  hint?: string;
  disabled?: boolean;
  onSelect?: () => void;
}

export function MenuRadioItem({ value, children, hint, disabled, onSelect }: MenuRadioItemProps): JSX.Element {
  const root = useContext(MenuRootContext);
  const group = useContext(MenuRadioGroupContext);
  const checked = group?.value === value;
  return (
    <MenuRow
      role="menuitemradio"
      checked={checked}
      lead={checked ? <PixelIcon name="square-fill" size={16} /> : null}
      label={children}
      hint={hint}
      disabled={disabled}
      onActivate={() => {
        group?.setValue(value);
        onSelect?.();
        root.closeAll(true);
      }}
    />
  );
}

export function MenuSeparator(): JSX.Element {
  return <div className="rule sc-menu__rule" role="separator" />;
}

export interface MenuLabelProps {
  children: ReactNode;
}

/** A non-interactive section heading; the arrows walk straight past it. */
export function MenuLabel({ children }: MenuLabelProps): JSX.Element {
  return (
    <div className="sc-menu__heading" role="presentation">
      {children}
    </div>
  );
}

/* --------------------------------------------------------------------------
 * MenuSub — a row that owns a nested, portalled panel to its right.
 * ------------------------------------------------------------------------ */

export interface MenuSubProps {
  /** Plain string so typeahead and the nested panel's label come for free. */
  label: string;
  icon?: PixelIconName;
  disabled?: boolean;
  children: ReactNode;
}

export function MenuSub({ label, icon, disabled, children }: MenuSubProps): JSX.Element {
  const id = useId();
  const parent = useContext(MenuPanelContext);
  const open = parent?.openSubId === id;
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const modeRef = useRef<'first' | 'none'>('none');
  const position = useAnchorPosition(triggerRef, panelRef, open === true, 'right-start', 0);

  // The level is portalled, so a click inside it must not read as "outside"
  // to the owner's document-level dismissal listener.
  useEffect(() => {
    if (!open) return;
    const el = panelRef.current;
    if (!el) return;
    const stop = (event: PointerEvent): void => event.stopPropagation();
    el.addEventListener('pointerdown', stop);
    return () => el.removeEventListener('pointerdown', stop);
  }, [open]);

  const openSub = (mode: 'first' | 'none'): void => {
    modeRef.current = mode;
    parent?.setOpenSub(id);
  };

  const closeLevel = (): void => {
    parent?.setOpenSub(null);
    triggerRef.current?.focus();
  };

  return (
    <>
      <button
        type="button"
        role="menuitem"
        className="sc-menu__item"
        disabled={disabled}
        tabIndex={-1}
        ref={triggerRef}
        aria-haspopup="menu"
        aria-expanded={open === true}
        data-label={label}
        onPointerEnter={(event) => {
          event.currentTarget.focus();
          openSub('none');
        }}
        onClick={() => {
          if (open) focusMenuItem(panelRef.current, 'first');
          else openSub('first');
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowRight') {
            event.preventDefault();
            event.stopPropagation();
            if (open) focusMenuItem(panelRef.current, 'first');
            else openSub('first');
          }
        }}
      >
        <span className="sc-menu__lead" aria-hidden="true">
          {icon ? <PixelIcon name={icon} size={16} /> : null}
        </span>
        <span className="sc-menu__label">{label}</span>
        <span className="sc-menu__more" aria-hidden="true">
          <PixelIcon name="chevron-right" size={16} />
        </span>
      </button>
      {open ? (
        <Portal>
          <MenuPanel
            ref={panelRef}
            aria-label={label}
            focusOnMount={modeRef.current === 'first' ? 'first' : 'none'}
            onLevelClose={closeLevel}
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
    </>
  );
}
