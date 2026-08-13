/*
 * A run of toggles that share a decision. `type="single"` is the segmented
 * control (one tool at a time, a radiogroup); `type="multiple"` is a bank of
 * independent layer switches. Both are one tab stop: focus enters on the
 * active segment and the arrow keys walk the rest, per the APG roving
 * tabindex pattern.
 *
 * Item order is read back off the DOM rather than kept in a registry, so
 * children can be conditional, wrapped or reordered without the group losing
 * track of which segment carries the tab stop.
 */

import {
  createContext,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type FocusEvent,
  type HTMLAttributes,
  type JSX,
  type KeyboardEvent,
  type MouseEvent,
} from 'react';
import { PixelIcon, type PixelIconName } from '../../icons/PixelIcon';
import { cx } from '../../lib/cx';
import { useControllableState } from '../../lib/useControllableState';
import './ToggleGroup.css';

const ITEM_SELECTOR = '[data-sc-toggle-item]:not(:disabled)';
const NO_VALUES: string[] = [];

interface ToggleGroupContextValue {
  type: 'single' | 'multiple';
  size: 'sm' | 'md';
  groupDisabled: boolean;
  isSelected: (value: string) => boolean;
  isTabbable: (value: string) => boolean;
  select: (value: string) => void;
  focusItem: (value: string) => void;
}

const ToggleGroupContext = createContext<ToggleGroupContextValue | null>(null);

type ToggleGroupBaseProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  'defaultValue' | 'onChange' | 'role'
> & {
  /** Required: the group is one control, and it has to say what it decides. */
  'aria-label': string;
  /** Fuse the segments into one continuous run of chrome. */
  attached?: boolean;
  size?: 'sm' | 'md';
  /** Disables every segment at once. */
  disabled?: boolean;
};

export interface ToggleGroupSingleProps extends ToggleGroupBaseProps {
  type: 'single';
  value?: string | null;
  defaultValue?: string | null;
  onValueChange?: (value: string | null) => void;
  /** Let a second press on the active segment clear the group. */
  allowEmpty?: boolean;
}

export interface ToggleGroupMultipleProps extends ToggleGroupBaseProps {
  type: 'multiple';
  value?: string[];
  defaultValue?: string[];
  onValueChange?: (value: string[]) => void;
  /** Single mode only. */
  allowEmpty?: never;
}

export type ToggleGroupProps = ToggleGroupSingleProps | ToggleGroupMultipleProps;

export function ToggleGroup(props: ToggleGroupProps): JSX.Element {
  const {
    type,
    attached = true,
    size = 'md',
    disabled = false,
    allowEmpty = false,
    className,
    children,
    onKeyDown,
    value: _value,
    defaultValue: _defaultValue,
    onValueChange: _onValueChange,
    ...rest
  } = props;

  const single = type === 'single';
  const [singleValue, setSingleValue] = useControllableState<string | null>(
    props.type === 'single' ? props.value : undefined,
    (props.type === 'single' ? props.defaultValue : undefined) ?? null,
    props.type === 'single' ? props.onValueChange : undefined,
  );
  const [multipleValue, setMultipleValue] = useControllableState<string[]>(
    props.type === 'multiple' ? props.value : undefined,
    (props.type === 'multiple' ? props.defaultValue : undefined) ?? NO_VALUES,
    props.type === 'multiple' ? props.onValueChange : undefined,
  );

  const rootRef = useRef<HTMLDivElement>(null);
  /** Enabled item values in DOM order — the roving tabindex runs on this. */
  const [order, setOrder] = useState<string[]>([]);
  const [focusValue, setFocusValue] = useState<string | null>(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const next = Array.from(root.querySelectorAll<HTMLElement>(ITEM_SELECTOR)).map(
      (el) => el.dataset.value ?? '',
    );
    setOrder((prev) =>
      prev.length === next.length && prev.every((v, i) => v === next[i]) ? prev : next,
    );
  }, [children, disabled]);

  const isSelected = (value: string): boolean =>
    single ? singleValue === value : multipleValue.includes(value);

  /* The tab stop follows the last focused segment, and before anyone has
     touched it, the selected one — entering the group should land on the
     state it is already in. */
  const tabbable =
    focusValue !== null && order.includes(focusValue)
      ? focusValue
      : (order.find(isSelected) ?? order[0]);

  function select(value: string): void {
    if (single) {
      if (singleValue === value) {
        if (allowEmpty) setSingleValue(null);
        return;
      }
      setSingleValue(value);
      return;
    }
    setMultipleValue(
      multipleValue.includes(value)
        ? multipleValue.filter((v) => v !== value)
        : [...multipleValue, value],
    );
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    onKeyDown?.(event);
    if (event.defaultPrevented) return;
    const { key } = event;
    if (key !== 'ArrowLeft' && key !== 'ArrowRight' && key !== 'Home' && key !== 'End') return;
    const root = rootRef.current;
    if (!root) return;
    const items = Array.from(root.querySelectorAll<HTMLElement>(ITEM_SELECTOR));
    if (items.length === 0) return;

    const current = items.indexOf(document.activeElement as HTMLElement);
    let next: number;
    if (key === 'Home') next = 0;
    else if (key === 'End') next = items.length - 1;
    else if (current === -1) next = 0;
    else next = (current + (key === 'ArrowRight' ? 1 : -1) + items.length) % items.length;

    event.preventDefault();
    items[next].focus();
  }

  const context: ToggleGroupContextValue = {
    type,
    size,
    groupDisabled: disabled,
    isSelected,
    isTabbable: (value) => (order.length === 0 ? true : value === tabbable),
    select,
    focusItem: setFocusValue,
  };

  return (
    <div
      ref={rootRef}
      role={single ? 'radiogroup' : 'group'}
      className={cx(
        'sc-toggle-group',
        attached ? 'sc-toggle-group--attached' : 'sc-toggle-group--spaced',
        className,
      )}
      onKeyDown={handleKeyDown}
      {...rest}
    >
      <ToggleGroupContext.Provider value={context}>{children}</ToggleGroupContext.Provider>
    </div>
  );
}

export interface ToggleGroupItemProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'value'> {
  /** Identifies the segment in the group's value. */
  value: string;
  icon?: PixelIconName;
}

export function ToggleGroupItem({
  value,
  icon,
  className,
  children,
  disabled,
  onClick,
  onFocus,
  type = 'button',
  ...rest
}: ToggleGroupItemProps): JSX.Element {
  const group = useContext(ToggleGroupContext);
  if (!group) {
    throw new Error('<ToggleGroupItem> must be rendered inside a <ToggleGroup>.');
  }

  const selected = group.isSelected(value);
  const single = group.type === 'single';

  const handleClick = (event: MouseEvent<HTMLButtonElement>): void => {
    onClick?.(event);
    if (event.defaultPrevented) return;
    group.select(value);
  };

  const handleFocus = (event: FocusEvent<HTMLButtonElement>): void => {
    onFocus?.(event);
    group.focusItem(value);
  };

  return (
    <button
      type={type}
      data-sc-toggle-item=""
      data-value={value}
      role={single ? 'radio' : undefined}
      aria-checked={single ? selected : undefined}
      aria-pressed={single ? undefined : selected}
      tabIndex={group.isTabbable(value) ? 0 : -1}
      disabled={disabled || group.groupDisabled}
      className={cx(
        'sc-toggle-group__item',
        group.size === 'sm' && 'sc-toggle-group__item--sm',
        selected && 'sc-toggle-group__item--on',
        className,
      )}
      onClick={handleClick}
      onFocus={handleFocus}
      {...rest}
    >
      {icon ? <PixelIcon name={icon} size={16} /> : null}
      {children}
    </button>
  );
}
