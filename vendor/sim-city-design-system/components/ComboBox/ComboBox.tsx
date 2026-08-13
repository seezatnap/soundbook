/*
 * ARIA 1.2 editable combobox: a TextField that files suggestions. Typing
 * filters the register by case-insensitive substring and calls out the match
 * in accent ink; the chevron opens the whole register unfiltered. DOM focus
 * stays in the input — the popup rows are virtual focus only.
 *
 * The draft in the well and the value on file are different things. Enter and
 * option clicks move the draft onto the file; Escape throws the draft away;
 * leaving the field files the active suggestion — unless `allowsCustomValue`
 * says a write-in is a legal answer, in which case the text itself is filed.
 */

import {
  useCallback,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
  type JSX,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import {
  ListBox,
  listBoxOptionId,
  reduceActiveIndex,
  type ListBoxOptionData,
} from '../ListBox';
import { TextField } from '../TextField';
import type { FieldBaseProps } from '../TextField';
import { PixelIcon } from '../../icons/PixelIcon';
import { cx } from '../../lib/cx';
import { Portal, useAnchorPosition, useDismissable } from '../../lib/overlays';
import { useControllableState } from '../../lib/useControllableState';
import './ComboBox.css';

export interface ComboBoxProps extends FieldBaseProps {
  options: ListBoxOptionData[];
  /** The committed value — an option's `value`, or free text if allowed. */
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Leaving the field keeps whatever was typed instead of forcing an option. */
  allowsCustomValue?: boolean;
  placeholder?: string;
  id?: string;
  className?: string;
  style?: CSSProperties;
}

function filterOptions(options: ListBoxOptionData[], query: string | null): ListBoxOptionData[] {
  if (query === null || query === '') return options;
  const q = query.toLowerCase();
  return options.filter((option) => option.label.toLowerCase().includes(q));
}

/** The matched substring rendered in accent ink, first occurrence only. */
function highlightLabel(label: string, query: string): ReactNode {
  if (query === '') return label;
  const at = label.toLowerCase().indexOf(query.toLowerCase());
  if (at === -1) return label;
  return (
    <>
      {label.slice(0, at)}
      <span className="sc-option__match">{label.slice(at, at + query.length)}</span>
      {label.slice(at + query.length)}
    </>
  );
}

export function ComboBox({
  options,
  value: valueProp,
  defaultValue = '',
  onValueChange,
  allowsCustomValue = false,
  placeholder,
  label,
  description,
  errorMessage,
  invalid,
  required,
  disabled,
  id,
  className,
  style,
}: ComboBoxProps): JSX.Element {
  const [value, setValue] = useControllableState(valueProp, defaultValue, onValueChange);

  const displayFor = useCallback(
    (v: string): string => options.find((option) => option.value === v)?.label ?? v,
    [options],
  );

  const [text, setText] = useState(() => displayFor(value));
  const [open, setOpen] = useState(false);
  /** Null: the full register. A string: what the rows are filtered by. */
  const [filter, setFilter] = useState<string | null>(null);
  const [active, setActive] = useState(-1);
  const [popupMinWidth, setPopupMinWidth] = useState(0);

  // External commits reset the draft — the classic derived-state adjustment.
  const [prevValue, setPrevValue] = useState(value);
  if (prevValue !== value) {
    setPrevValue(value);
    setText(displayFor(value));
  }

  const inputRef = useRef<HTMLInputElement | null>(null);
  const wellRef = useRef<HTMLElement | null>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const uid = useId();
  const listId = `sc-combobox-list-${uid}`;

  const visible = useMemo(() => filterOptions(options, filter), [options, filter]);
  const isEnabled = useCallback((index: number) => !visible[index]?.disabled, [visible]);
  const dirty = text !== displayFor(value);

  useLayoutEffect(() => {
    if (open) setPopupMinWidth(wellRef.current?.offsetWidth ?? 0);
  }, [open]);

  const position = useAnchorPosition(wellRef, popupRef, open, 'bottom-start');

  const closePopup = useCallback(() => {
    setOpen(false);
    setActive(-1);
  }, []);
  const inside = useMemo(() => [wellRef, popupRef], []);
  useDismissable({ onDismiss: closePopup, inside, enabled: open });

  const commitOption = (option: ListBoxOptionData): void => {
    setValue(option.value);
    setText(option.label);
    setFilter(null);
    closePopup();
  };

  const revertDraft = (): void => {
    setText(displayFor(value));
    setFilter(null);
  };

  const handleType = (next: string): void => {
    setText(next);
    setFilter(next);
    const rows = filterOptions(options, next);
    setActive(reduceActiveIndex(-1, 'next', rows.length, (i) => !rows[i]?.disabled));
    setOpen(true);
  };

  const openViaKeyboard = (direction: 'next' | 'prev'): void => {
    const nextFilter = dirty ? text : null;
    const rows = filterOptions(options, nextFilter);
    const committedIndex = rows.findIndex((option) => option.value === value);
    const start =
      !dirty && committedIndex >= 0
        ? committedIndex
        : reduceActiveIndex(-1, direction === 'prev' ? 'last' : 'next', rows.length, (i) => !rows[i]?.disabled);
    setFilter(nextFilter);
    setActive(start);
    setOpen(true);
  };

  const toggleList = (): void => {
    inputRef.current?.focus();
    if (open) {
      closePopup();
      return;
    }
    setFilter(null);
    setActive(options.findIndex((option) => option.value === value));
    setOpen(true);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        event.preventDefault();
        const direction = event.key === 'ArrowDown' ? 'next' : 'prev';
        if (!open) openViaKeyboard(direction);
        else setActive(reduceActiveIndex(active, direction, visible.length, isEnabled));
        break;
      }
      case 'Enter':
        if (!open) return;
        event.preventDefault();
        if (active >= 0 && visible[active] && !visible[active].disabled) {
          commitOption(visible[active]);
        } else if (allowsCustomValue) {
          setValue(text);
          setFilter(null);
          closePopup();
        } else {
          closePopup();
        }
        break;
      case 'Escape':
        if (open) {
          event.preventDefault();
          event.stopPropagation();
          revertDraft();
          closePopup();
        } else if (dirty) {
          event.stopPropagation();
          revertDraft();
        }
        break;
      default:
        break;
    }
  };

  // Leaving the field settles the draft one way or the other.
  const handleBlur = (event: FocusEvent<HTMLInputElement>): void => {
    const next = event.relatedTarget as Node | null;
    if (next && (popupRef.current?.contains(next) || wellRef.current?.contains(next))) return;
    if (!dirty) {
      closePopup();
      return;
    }
    if (allowsCustomValue) {
      setValue(text);
      setFilter(null);
      closePopup();
      return;
    }
    if (open && active >= 0 && visible[active] && !visible[active].disabled) {
      commitOption(visible[active]);
      return;
    }
    const exact = options.find(
      (option) => !option.disabled && option.label.toLowerCase() === text.toLowerCase(),
    );
    if (exact) commitOption(exact);
    else {
      revertDraft();
      closePopup();
    }
  };

  return (
    <>
      <TextField
        label={label}
        description={description}
        errorMessage={errorMessage}
        invalid={invalid}
        required={required}
        disabled={disabled}
        id={id}
        className={className}
        style={style}
        placeholder={placeholder}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && active >= 0 ? listBoxOptionId(listId, active) : undefined}
        autoComplete="off"
        spellCheck={false}
        value={text}
        onValueChange={handleType}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        ref={(node: HTMLInputElement | null) => {
          inputRef.current = node;
          wellRef.current = node?.closest('.sc-textfield') ?? null;
        }}
        suffix={
          <button
            type="button"
            className={cx('sc-combobox__button', open && 'sc-combobox__button--open')}
            aria-label="Show options"
            tabIndex={-1}
            disabled={disabled}
            // A nudge for the mouse; focus stays in the well.
            onMouseDown={(event) => event.preventDefault()}
            onClick={toggleList}
          >
            <PixelIcon name="chevron-down" size={16} />
          </button>
        }
      />
      {open && (
        <Portal>
          <div
            ref={popupRef}
            className="sc-combobox__popup"
            style={{
              top: position?.top ?? 0,
              left: position?.left ?? 0,
              minWidth: popupMinWidth || undefined,
              visibility: position ? undefined : 'hidden',
            }}
            onMouseDown={(event) => event.preventDefault()}
          >
            <ListBox
              id={listId}
              variant="popup"
              focusable={false}
              options={visible}
              selected={value !== '' ? [value] : []}
              activeIndex={active}
              onActiveIndexChange={setActive}
              renderLabel={(option) => highlightLabel(option.label, filter ?? '')}
              emptyMessage="NO MATCHES ON FILE"
              onOptionPress={(option) => commitOption(option)}
              aria-label={typeof label === 'string' ? label : 'Suggestions'}
            />
          </div>
        </Portal>
      )}
    </>
  );
}
