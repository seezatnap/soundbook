/*
 * Folder tabs, APG-correct. One tab is "up": it stands 2px taller, wears the
 * raised face, and its missing bottom edge fuses it with the panel below —
 * the classic card-index trick, drawn entirely with the two edge colours.
 */

import {
  createContext,
  useContext,
  useId,
  useRef,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type JSX,
  type KeyboardEvent,
} from 'react';
import { cx } from '../../lib/cx';
import { useControllableState } from '../../lib/useControllableState';
import './Tabs.css';

interface TabsContextValue {
  value: string;
  setValue: (next: string) => void;
  activation: 'auto' | 'manual';
  baseId: string;
}

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabsContext(part: string): TabsContextValue {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error(`<${part}> must be used inside <Tabs>`);
  return ctx;
}

/* Values become element ids; scrub anything an id cannot hold. */
function slug(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '_');
}

export interface TabsProps extends Omit<HTMLAttributes<HTMLDivElement>, 'defaultValue'> {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** "auto" activates on arrow-key focus; "manual" waits for Enter/Space. */
  activation?: 'auto' | 'manual';
}

export function Tabs({
  value,
  defaultValue = '',
  onValueChange,
  activation = 'auto',
  className,
  children,
  ...rest
}: TabsProps): JSX.Element {
  const [current, setCurrent] = useControllableState(value, defaultValue, onValueChange);
  const baseId = useId();
  return (
    <TabsContext.Provider value={{ value: current, setValue: setCurrent, activation, baseId }}>
      <div className={cx('sc-tabs', className)} {...rest}>
        {children}
      </div>
    </TabsContext.Provider>
  );
}

export type TabListProps = HTMLAttributes<HTMLDivElement>;

export function TabList({ className, children, onKeyDown, ...rest }: TabListProps): JSX.Element {
  const { activation } = useTabsContext('TabList');
  const listRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented || !listRef.current) return;
    const tabs = Array.from(
      listRef.current.querySelectorAll<HTMLButtonElement>('[role="tab"]:not(:disabled)'),
    );
    if (tabs.length === 0) return;
    const from = tabs.indexOf(document.activeElement as HTMLButtonElement);
    let to = -1;
    switch (event.key) {
      case 'ArrowRight':
        to = from < 0 ? 0 : (from + 1) % tabs.length;
        break;
      case 'ArrowLeft':
        to = from < 0 ? tabs.length - 1 : (from - 1 + tabs.length) % tabs.length;
        break;
      case 'Home':
        to = 0;
        break;
      case 'End':
        to = tabs.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    const target = tabs[to];
    target.focus();
    if (activation === 'auto') target.click();
  };

  return (
    <div
      ref={listRef}
      role="tablist"
      className={cx('sc-tabs__list', className)}
      onKeyDown={handleKeyDown}
      {...rest}
    >
      {children}
    </div>
  );
}

export interface TabProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'value'> {
  /** Matches this tab to its TabPanel. */
  value: string;
}

export function Tab({ value, className, children, onClick, ...rest }: TabProps): JSX.Element {
  const { value: current, setValue, baseId } = useTabsContext('Tab');
  const selected = current === value;
  return (
    <button
      type="button"
      role="tab"
      id={`${baseId}-tab-${slug(value)}`}
      aria-selected={selected}
      aria-controls={`${baseId}-panel-${slug(value)}`}
      tabIndex={selected ? 0 : -1}
      className={cx('sc-tabs__tab', className)}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) setValue(value);
      }}
      {...rest}
    >
      {children}
    </button>
  );
}

export interface TabPanelProps extends HTMLAttributes<HTMLDivElement> {
  /** Matches this panel to its Tab. */
  value: string;
}

export function TabPanel({ value, className, children, ...rest }: TabPanelProps): JSX.Element {
  const { value: current, baseId } = useTabsContext('TabPanel');
  const selected = current === value;
  return (
    <div
      role="tabpanel"
      id={`${baseId}-panel-${slug(value)}`}
      aria-labelledby={`${baseId}-tab-${slug(value)}`}
      hidden={!selected}
      tabIndex={0}
      className={cx('sc-tabs__panel', className)}
      {...rest}
    >
      {children}
    </div>
  );
}
