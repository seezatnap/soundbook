/*
 * The standalone selectable list, and the engine the whole picker family runs
 * on. Select, ComboBox and MultiSelect all render this same listbox in a
 * popup; only the element that holds DOM focus changes. Focus here is virtual —
 * the listbox (or the combobox driving it) keeps DOM focus and moves
 * `aria-activedescendant` — because a 1993 list did not tab through its rows
 * and neither does the APG pattern.
 */

import {
  Children,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  type CSSProperties,
  type JSX,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { PixelIcon } from '../../icons/PixelIcon';
import { cx } from '../../lib/cx';
import { useControllableState } from '../../lib/useControllableState';
import './ListBox.css';

export type ListBoxSelectionMode = 'single' | 'multiple';

export interface ListBoxOptionData {
  value: string;
  label: string;
  /** Second dim line under the label — a district, a file number. */
  description?: string;
  disabled?: boolean;
}

/* ------------------------------------------------------------------------- *
 * Active-index reducer: every arrow, Home and End in the family lands here.
 * No wrapping — a municipal list has a top and a bottom and hitting either
 * is information, not an invitation to loop.
 * ------------------------------------------------------------------------- */

export type ActiveIndexMove = 'next' | 'prev' | 'first' | 'last';

export function reduceActiveIndex(
  current: number,
  move: ActiveIndexMove,
  count: number,
  isEnabled: (index: number) => boolean,
): number {
  if (count === 0) return -1;
  const dir = move === 'prev' || move === 'last' ? -1 : 1;
  let index: number;
  switch (move) {
    case 'first':
      index = 0;
      break;
    case 'last':
      index = count - 1;
      break;
    case 'next':
      index = current < 0 ? 0 : current + 1;
      break;
    case 'prev':
      index = current < 0 ? count - 1 : current - 1;
      break;
  }
  while (index >= 0 && index < count && !isEnabled(index)) index += dir;
  if (index < 0 || index >= count) return current;
  return index;
}

/* ------------------------------------------------------------------------- *
 * Typeahead: printable characters accumulate for half a second and jump the
 * active option to the next label with that prefix. Repeating one character
 * cycles through everything starting with it.
 * ------------------------------------------------------------------------- */

export type TypeaheadHandler = (
  char: string,
  labels: readonly string[],
  from: number,
  isEnabled: (index: number) => boolean,
) => number;

export function useTypeahead(): TypeaheadHandler {
  const bufferRef = useRef('');
  const timerRef = useRef(0);

  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  return useCallback((char, labels, from, isEnabled) => {
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      bufferRef.current = '';
    }, 500);

    bufferRef.current += char.toLowerCase();
    let query = bufferRef.current;
    // "aaa" means "next thing starting with a", not a hunt for "aaa".
    if (query.length > 1 && query.split('').every((c) => c === query[0])) {
      query = query[0];
      bufferRef.current = query;
    }

    const start = Math.max(from, 0) + (query.length === 1 ? 1 : 0);
    for (let i = 0; i < labels.length; i++) {
      const index = (start + i) % labels.length;
      if (!isEnabled(index)) continue;
      if (labels[index].toLowerCase().startsWith(query)) return index;
    }
    return -1;
  }, []);
}

/** The id an option row renders with, so a combobox can point at it. */
export function listBoxOptionId(listboxId: string, index: number): string {
  return `${listboxId}-opt-${index}`;
}

/* ------------------------------------------------------------------------- *
 * The row renderer, shared by every popup in the family. A fixed 16px check
 * column keeps labels aligned whether or not anything is selected yet, and
 * the active row takes the full accent plate — the system's one selection
 * idiom, never a tint.
 * ------------------------------------------------------------------------- */

export interface OptionRowProps {
  id: string;
  option: ListBoxOptionData;
  active: boolean;
  selected: boolean;
  /** Override the label rendering (ComboBox highlights the matched substring). */
  label?: ReactNode;
  onPress?: (event: MouseEvent<HTMLDivElement>) => void;
  /** Pointer travel over the row; popups move virtual focus with it. */
  onHover?: () => void;
}

export function OptionRow({
  id,
  option,
  active,
  selected,
  label,
  onPress,
  onHover,
}: OptionRowProps): JSX.Element {
  return (
    <div
      id={id}
      role="option"
      aria-selected={selected}
      aria-disabled={option.disabled || undefined}
      data-active={active || undefined}
      className={cx(
        'sc-option',
        active && 'sc-option--active',
        option.disabled && 'sc-option--disabled',
      )}
      onClick={option.disabled ? undefined : onPress}
      onMouseMove={option.disabled ? undefined : onHover}
    >
      <span className="sc-option__check" aria-hidden="true">
        {selected ? <PixelIcon name="check" size={16} /> : null}
      </span>
      <span className="sc-option__text">
        <span className="sc-option__label">{label ?? option.label}</span>
        {option.description !== undefined && (
          <span className="sc-option__description">{option.description}</span>
        )}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------------- *
 * ListBoxOption: the composed-children spelling of an option. Never rendered
 * itself — the ListBox reads its props and hands them to the row renderer,
 * so data options and child options are the same thing by the time keyboard
 * logic sees them.
 * ------------------------------------------------------------------------- */

export interface ListBoxOptionProps {
  value: string;
  description?: string;
  disabled?: boolean;
  /** The label. A plain string so typeahead and filtering can read it. */
  children: string;
}

export function ListBoxOption(_props: ListBoxOptionProps): null {
  return null;
}

function optionsFromChildren(children: ReactNode): ListBoxOptionData[] {
  const out: ListBoxOptionData[] = [];
  Children.forEach(children, (child) => {
    if (!isValidElement<ListBoxOptionProps>(child) || child.type !== ListBoxOption) return;
    const { value, description, disabled, children: label } = child.props;
    out.push({ value, label, description, disabled });
  });
  return out;
}

/* ------------------------------------------------------------------------- */

export interface ListBoxProps {
  /** Options as data; or compose `<ListBoxOption>` children instead. */
  options?: ListBoxOptionData[];
  children?: ReactNode;
  selectionMode?: ListBoxSelectionMode;
  selected?: string[];
  defaultSelected?: string[];
  onSelectionChange?: (selected: string[]) => void;
  /** Controlled virtual focus, for comboboxes that drive the list remotely. */
  activeIndex?: number;
  defaultActiveIndex?: number;
  onActiveIndexChange?: (index: number) => void;
  /**
   * False when a combobox owns DOM focus and this list is display only:
   * drops tabIndex, keyboard handling and the list's own activedescendant.
   */
  focusable?: boolean;
  /**
   * Multiple-mode plain click toggles instead of replacing. Combobox popups
   * want this; a standalone list keeps the file-manager idiom (plain click
   * replaces, Ctrl/Cmd toggles, Shift ranges).
   */
  toggleOnClick?: boolean;
  /** 'sunken' is the standalone well; 'popup' is the raised panel form. */
  variant?: 'sunken' | 'popup';
  /** Override label rendering per row (substring highlighting). */
  renderLabel?: (option: ListBoxOptionData) => ReactNode;
  /** Dim row shown when there are no options at all. */
  emptyMessage?: ReactNode;
  /** Fires after selection handling when a row is clicked. */
  onOptionPress?: (option: ListBoxOptionData, index: number) => void;
  maxHeight?: number;
  disabled?: boolean;
  id?: string;
  className?: string;
  style?: CSSProperties;
  'aria-label'?: string;
  'aria-labelledby'?: string;
}

export function ListBox({
  options,
  children,
  selectionMode = 'single',
  selected: selectedProp,
  defaultSelected,
  onSelectionChange,
  activeIndex: activeIndexProp,
  defaultActiveIndex,
  onActiveIndexChange,
  focusable = true,
  toggleOnClick = false,
  variant = 'sunken',
  renderLabel,
  emptyMessage,
  onOptionPress,
  maxHeight,
  disabled = false,
  id,
  className,
  style,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
}: ListBoxProps): JSX.Element {
  const autoId = useId();
  const listId = id ?? `sc-listbox-${autoId}`;
  const items = useMemo(
    () => options ?? optionsFromChildren(children),
    [options, children],
  );

  const [selected, setSelected] = useControllableState<string[]>(
    selectedProp,
    defaultSelected ?? [],
    onSelectionChange,
  );
  const [active, setActive] = useControllableState<number>(
    activeIndexProp,
    defaultActiveIndex ?? -1,
    onActiveIndexChange,
  );

  const listRef = useRef<HTMLDivElement>(null);
  /** Where a Shift range measures from: the last non-shift interaction. */
  const anchorRef = useRef(-1);
  const typeahead = useTypeahead();

  const isEnabled = useCallback(
    (index: number) => !disabled && !items[index]?.disabled,
    [disabled, items],
  );
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const labels = useMemo(() => items.map((item) => item.label), [items]);

  // Virtual focus has no browser to keep it in view, so we do it by hand.
  useEffect(() => {
    if (active < 0) return;
    const row = listRef.current?.querySelector<HTMLElement>('[data-active]');
    row?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const rangeValues = (a: number, b: number): string[] => {
    const [lo, hi] = a <= b ? [a, b] : [b, a];
    const out: string[] = [];
    for (let i = Math.max(lo, 0); i <= hi && i < items.length; i++) {
      if (!items[i].disabled) out.push(items[i].value);
    }
    return out;
  };

  const toggleValue = (value: string): string[] =>
    selectedSet.has(value) ? selected.filter((v) => v !== value) : [...selected, value];

  const applyAction = (index: number, event?: MouseEvent): void => {
    const item = items[index];
    if (!item || item.disabled) return;
    if (selectionMode === 'single') {
      setSelected([item.value]);
      anchorRef.current = index;
      return;
    }
    if (event?.shiftKey && anchorRef.current >= 0) {
      setSelected(rangeValues(anchorRef.current, index));
      return;
    }
    if (event && (event.ctrlKey || event.metaKey)) {
      setSelected(toggleValue(item.value));
      anchorRef.current = index;
      return;
    }
    // Plain pointer or Space/Enter.
    if (event && !toggleOnClick) setSelected([item.value]);
    else setSelected(toggleValue(item.value));
    anchorRef.current = index;
  };

  const handlePress = (index: number, event: MouseEvent<HTMLDivElement>): void => {
    if (disabled) return;
    setActive(index);
    applyAction(index, event);
    onOptionPress?.(items[index], index);
  };

  const moveActive = (move: ActiveIndexMove, extend: boolean): void => {
    const next = reduceActiveIndex(active, move, items.length, isEnabled);
    if (next < 0 || next === active) return;
    setActive(next);
    if (extend && selectionMode === 'multiple') {
      if (anchorRef.current < 0) anchorRef.current = active >= 0 ? active : next;
      setSelected(rangeValues(anchorRef.current, next));
    } else {
      anchorRef.current = next;
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (disabled) return;
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        moveActive('next', event.shiftKey);
        break;
      case 'ArrowUp':
        event.preventDefault();
        moveActive('prev', event.shiftKey);
        break;
      case 'Home':
        event.preventDefault();
        moveActive('first', event.shiftKey);
        break;
      case 'End':
        event.preventDefault();
        moveActive('last', event.shiftKey);
        break;
      case ' ':
      case 'Enter':
        event.preventDefault();
        if (active >= 0) applyAction(active);
        break;
      default: {
        if (event.key.length !== 1 || event.ctrlKey || event.metaKey || event.altKey) return;
        // Typed characters belong to the typeahead; hosts (the Storybook
        // manager among them) bind bare letters as global hotkeys, and only
        // stopping propagation here keeps a search from toggling their UI.
        event.preventDefault();
        event.stopPropagation();
        const match = typeahead(event.key, labels, active, isEnabled);
        if (match >= 0) {
          setActive(match);
          anchorRef.current = match;
        }
      }
    }
  };

  // Landing on the list puts virtual focus somewhere sensible: the first
  // selected row if there is one, else the first row that can be chosen.
  const handleFocus = (): void => {
    if (active >= 0 || items.length === 0) return;
    const firstSelected = items.findIndex((item) => selectedSet.has(item.value));
    const start =
      firstSelected >= 0 ? firstSelected : reduceActiveIndex(-1, 'next', items.length, isEnabled);
    if (start >= 0) setActive(start);
  };

  const interactive = focusable && !disabled;

  return (
    <div
      ref={listRef}
      id={listId}
      role="listbox"
      aria-multiselectable={selectionMode === 'multiple' || undefined}
      aria-disabled={disabled || undefined}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      aria-activedescendant={
        interactive && active >= 0 ? listBoxOptionId(listId, active) : undefined
      }
      tabIndex={interactive ? 0 : undefined}
      className={cx(
        'sc-listbox',
        variant === 'popup' && 'sc-listbox--popup',
        disabled && 'sc-listbox--disabled',
        className,
      )}
      style={maxHeight !== undefined ? { ...style, maxHeight } : style}
      onKeyDown={interactive ? handleKeyDown : undefined}
      onFocus={interactive ? handleFocus : undefined}
    >
      {items.map((item, index) => (
        <OptionRow
          key={item.value}
          id={listBoxOptionId(listId, index)}
          option={disabled ? { ...item, disabled: true } : item}
          active={!disabled && index === active}
          selected={selectedSet.has(item.value)}
          label={renderLabel?.(item)}
          onPress={(event) => handlePress(index, event)}
          onHover={variant === 'popup' ? () => setActive(index) : undefined}
        />
      ))}
      {items.length === 0 && emptyMessage !== undefined && emptyMessage !== null && (
        <div className="sc-listbox__empty" role="presentation">
          {emptyMessage}
        </div>
      )}
    </div>
  );
}
