/*
 * A multiple-selection ComboBox: one sunken well holding the chips already
 * filed and the input that files more. The popup ListBox runs in multiple
 * mode and stays open across picks — assigning crews is a batch job, not four
 * trips to the counter. Backspace in an empty input strikes the last chip,
 * and each chip carries its own ✕.
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
  type PointerEvent,
  type ReactNode,
} from 'react';
import {
  ListBox,
  listBoxOptionId,
  reduceActiveIndex,
  type ListBoxOptionData,
} from '../ListBox';
import { Tag } from '../Tag';
import { FieldShell, useFieldIds, type FieldBaseProps } from '../TextField';
import { PixelIcon } from '../../icons/PixelIcon';
import { cx } from '../../lib/cx';
import { Portal, useAnchorPosition, useDismissable } from '../../lib/overlays';
import { useControllableState } from '../../lib/useControllableState';
import './MultiSelect.css';

export interface MultiSelectProps extends FieldBaseProps {
  options: ListBoxOptionData[];
  value?: string[];
  defaultValue?: string[];
  onValueChange?: (value: string[]) => void;
  /** Shown only while nothing at all is filed. */
  placeholder?: string;
  id?: string;
  className?: string;
  style?: CSSProperties;
}

function filterOptions(options: ListBoxOptionData[], query: string): ListBoxOptionData[] {
  if (query === '') return options;
  const q = query.toLowerCase();
  return options.filter((option) => option.label.toLowerCase().includes(q));
}

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

export function MultiSelect({
  options,
  value: valueProp,
  defaultValue,
  onValueChange,
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
}: MultiSelectProps): JSX.Element {
  const ids = useFieldIds({ id, description, errorMessage, invalid });
  const [value, setValue] = useControllableState<string[]>(
    valueProp,
    defaultValue ?? [],
    onValueChange,
  );
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [popupMinWidth, setPopupMinWidth] = useState(0);

  const wellRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const uid = useId();
  const listId = `sc-multiselect-list-${uid}`;

  const visible = useMemo(() => filterOptions(options, text), [options, text]);
  const isEnabled = useCallback((index: number) => !visible[index]?.disabled, [visible]);

  /** Chips render in the order things were picked, not register order. */
  const selectedOptions = useMemo(
    () =>
      value.map(
        (v) => options.find((option) => option.value === v) ?? { value: v, label: v },
      ),
    [value, options],
  );

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

  const toggleValue = (option: ListBoxOptionData): void => {
    setValue(
      value.includes(option.value)
        ? value.filter((v) => v !== option.value)
        : [...value, option.value],
    );
  };

  /** After a pick the filter resets but the popup and the place both hold. */
  const settleAfterPick = (option: ListBoxOptionData): void => {
    setText('');
    setActive(options.findIndex((o) => o.value === option.value));
  };

  const handleType = (next: string): void => {
    setText(next);
    const rows = filterOptions(options, next);
    setActive(reduceActiveIndex(-1, 'next', rows.length, (i) => !rows[i]?.disabled));
    setOpen(true);
  };

  const openList = (direction: 'next' | 'prev'): void => {
    const start = reduceActiveIndex(-1, direction === 'prev' ? 'last' : 'next', visible.length, isEnabled);
    setActive(start);
    setOpen(true);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        event.preventDefault();
        const direction = event.key === 'ArrowDown' ? 'next' : 'prev';
        if (!open) openList(direction);
        else setActive(reduceActiveIndex(active, direction, visible.length, isEnabled));
        break;
      }
      case 'Enter':
        if (!open) return;
        event.preventDefault();
        if (active >= 0 && visible[active] && !visible[active].disabled) {
          const option = visible[active];
          toggleValue(option);
          settleAfterPick(option);
        }
        break;
      case 'Backspace':
        // An empty input strikes the last chip from the record.
        if (text === '' && value.length > 0) {
          event.preventDefault();
          setValue(value.slice(0, -1));
        }
        break;
      case 'Escape':
        if (open) {
          event.preventDefault();
          event.stopPropagation();
          setText('');
          closePopup();
        } else if (text !== '') {
          event.stopPropagation();
          setText('');
        }
        break;
      default:
        break;
    }
  };

  const toggleList = (): void => {
    inputRef.current?.focus();
    if (open) closePopup();
    else {
      setActive(-1);
      setOpen(true);
    }
  };

  // Clicking the well's empty space is clicking the input.
  const handleWellPointerDown = (event: PointerEvent<HTMLDivElement>): void => {
    if (disabled) return;
    const target = event.target as HTMLElement;
    if (target.closest('[data-sc-tag], button, input')) return;
    event.preventDefault();
    inputRef.current?.focus();
  };

  const handleWellBlur = (event: FocusEvent<HTMLDivElement>): void => {
    const next = event.relatedTarget as Node | null;
    if (next && (wellRef.current?.contains(next) || popupRef.current?.contains(next))) return;
    setText('');
    closePopup();
  };

  return (
    <>
      <FieldShell
        ids={ids}
        label={label}
        description={description}
        errorMessage={errorMessage}
        required={required}
        disabled={disabled}
        className={className}
        style={style}
      >
        <div
          ref={wellRef}
          className={cx(
            'sc-multiselect',
            ids.invalid && 'sc-multiselect--invalid',
            disabled && 'sc-multiselect--disabled',
          )}
          data-sc-tag-group=""
          tabIndex={-1}
          onPointerDown={handleWellPointerDown}
          onBlur={handleWellBlur}
        >
          {selectedOptions.map((option) => (
            <Tag
              key={option.value}
              onRemove={
                disabled
                  ? undefined
                  : () => setValue(value.filter((v) => v !== option.value))
              }
              removeLabel={`Remove ${option.label}`}
            >
              {option.label}
            </Tag>
          ))}
          <input
            ref={inputRef}
            id={ids.controlId}
            className="sc-multiselect__input"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={open}
            aria-controls={listId}
            aria-activedescendant={
              open && active >= 0 ? listBoxOptionId(listId, active) : undefined
            }
            aria-invalid={ids.invalid || undefined}
            aria-describedby={ids.describedBy}
            aria-required={required || undefined}
            autoComplete="off"
            spellCheck={false}
            disabled={disabled}
            placeholder={value.length === 0 && !disabled ? placeholder : undefined}
            value={text}
            onChange={(event) => handleType(event.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button
            type="button"
            className={cx('sc-multiselect__button', open && 'sc-multiselect__button--open')}
            aria-label="Show options"
            tabIndex={-1}
            disabled={disabled}
            onMouseDown={(event) => event.preventDefault()}
            onClick={toggleList}
          >
            <PixelIcon name="chevron-down" size={16} />
          </button>
        </div>
      </FieldShell>
      {open && (
        <Portal>
          <div
            ref={popupRef}
            className="sc-multiselect__popup"
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
              selectionMode="multiple"
              toggleOnClick
              options={visible}
              selected={value}
              activeIndex={active}
              onActiveIndexChange={setActive}
              onSelectionChange={setValue}
              renderLabel={(option) => highlightLabel(option.label, text)}
              emptyMessage="NO MATCHES ON FILE"
              onOptionPress={(option) => settleAfterPick(option)}
              aria-labelledby={label !== undefined ? ids.labelId : undefined}
            />
          </div>
        </Portal>
      )}
    </>
  );
}
