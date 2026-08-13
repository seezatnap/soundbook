/*
 * APG toolbar: one tab stop for the whole strip, arrows to walk it.
 *
 * Children are arbitrary — Buttons, toggles, selects — so the roving tabindex
 * is kept by collecting focusables from the toolbar's own DOM in document
 * order (a MutationObserver re-collects when rows appear, vanish or disable)
 * rather than asking every child to register itself. The primary-axis arrows
 * move focus and wrap; Home/End jump; Tab leaves the toolbar entirely.
 * Widgets that consume arrows themselves (selects, text inputs) keep them.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react';
import type {
  FocusEvent as ReactFocusEvent,
  HTMLAttributes,
  JSX,
  KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { cx } from '../../lib/cx';
import './Toolbar.css';

type Orientation = 'horizontal' | 'vertical';

interface ToolbarContextValue {
  orientation: Orientation;
}

const ToolbarContext = createContext<ToolbarContextValue>({ orientation: 'horizontal' });

/*
 * No `[tabindex]` clause: the toolbar itself rewrites tabindex on its items,
 * so filtering on it would forget every row but the active one.
 */
const FOCUSABLE =
  'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled)';

export interface ToolbarProps extends HTMLAttributes<HTMLDivElement> {
  orientation?: Orientation;
}

export function Toolbar({
  orientation = 'horizontal',
  className,
  children,
  onKeyDown,
  onFocus,
  ...rest
}: ToolbarProps): JSX.Element {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const activeRef = useRef<HTMLElement | null>(null);

  const applyTabStops = useCallback((): void => {
    const root = rootRef.current;
    if (!root) return;
    const items = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (items.length === 0) return;
    if (!activeRef.current || !items.includes(activeRef.current)) activeRef.current = items[0];
    for (const item of items) item.tabIndex = item === activeRef.current ? 0 : -1;
  }, []);

  useEffect(() => {
    applyTabStops();
    const root = rootRef.current;
    if (!root) return;
    const observer = new MutationObserver(applyTabStops);
    observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['disabled'],
    });
    return () => observer.disconnect();
  }, [applyTabStops]);

  const handleFocus = (event: ReactFocusEvent<HTMLDivElement>): void => {
    onFocus?.(event);
    const target = event.target as HTMLElement;
    if (target.matches(FOCUSABLE)) {
      activeRef.current = target;
      applyTabStops();
    }
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>): void => {
    onKeyDown?.(event);
    const root = rootRef.current;
    if (!root || event.defaultPrevented) return;
    const target = event.target as HTMLElement;
    // Inner widgets that spend arrows on their own value keep them.
    if (target.matches('select, input, textarea')) return;

    const forward = orientation === 'horizontal' ? 'ArrowRight' : 'ArrowDown';
    const back = orientation === 'horizontal' ? 'ArrowLeft' : 'ArrowUp';
    const items = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (items.length === 0) return;
    const index = items.indexOf(target);

    let next: HTMLElement | undefined;
    if (event.key === forward) next = items[(index + 1 + items.length) % items.length];
    else if (event.key === back) next = items[(index - 1 + items.length) % items.length];
    else if (event.key === 'Home') next = items[0];
    else if (event.key === 'End') next = items[items.length - 1];

    if (next) {
      event.preventDefault();
      activeRef.current = next;
      applyTabStops();
      next.focus();
    }
  };

  const value = useMemo(() => ({ orientation }), [orientation]);

  return (
    <ToolbarContext.Provider value={value}>
      <div
        {...rest}
        ref={rootRef}
        role="toolbar"
        aria-orientation={orientation}
        className={cx('sc-toolbar', orientation === 'vertical' && 'sc-toolbar--vertical', className)}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
      >
        {children}
      </div>
    </ToolbarContext.Provider>
  );
}

/** A groove between groups, run across the toolbar's axis. */
export function ToolbarSeparator(): JSX.Element {
  const { orientation } = useContext(ToolbarContext);
  return (
    <div
      className="sc-toolbar__rule"
      role="separator"
      aria-orientation={orientation === 'horizontal' ? 'vertical' : 'horizontal'}
    />
  );
}
