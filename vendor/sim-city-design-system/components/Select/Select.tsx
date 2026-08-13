/*
 * APG select-only combobox: a raised trigger wearing field anatomy, a ListBox
 * popup underneath. DOM focus never leaves the trigger — the popup is virtual
 * focus territory via aria-activedescendant.
 *
 * Selection follows focus, which the APG permits for this pattern: arrows
 * change the value directly, popup open or closed, exactly as the native
 * widget of the era did. Escape is therefore the undo — it closes the popup
 * and restores whatever value the session opened with.
 */

import {
  useCallback,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type JSX,
  type KeyboardEvent,
} from 'react';
import {
  ListBox,
  listBoxOptionId,
  reduceActiveIndex,
  useTypeahead,
  type ActiveIndexMove,
  type ListBoxOptionData,
} from '../ListBox';
import { FieldShell, useFieldIds, type FieldBaseProps } from '../TextField';
import { PixelIcon } from '../../icons/PixelIcon';
import { cx } from '../../lib/cx';
import { Portal, useAnchorPosition, useDismissable } from '../../lib/overlays';
import { useControllableState } from '../../lib/useControllableState';
import './Select.css';

export interface SelectProps extends FieldBaseProps {
  options: ListBoxOptionData[];
  value?: string | null;
  defaultValue?: string | null;
  onValueChange?: (value: string | null) => void;
  /** Dim text shown until something is on file. */
  placeholder?: string;
  id?: string;
  className?: string;
  style?: CSSProperties;
}

export function Select({
  options,
  value: valueProp,
  defaultValue = null,
  onValueChange,
  placeholder = 'Select…',
  label,
  description,
  errorMessage,
  invalid,
  required,
  disabled,
  id,
  className,
  style,
}: SelectProps): JSX.Element {
  const ids = useFieldIds({ id, description, errorMessage, invalid });
  const [value, setValue] = useControllableState<string | null>(
    valueProp,
    defaultValue,
    onValueChange,
  );
  const [open, setOpen] = useState(false);
  const [popupMinWidth, setPopupMinWidth] = useState(0);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  /** What Escape restores: the value on file when this popup session began. */
  const valueAtOpenRef = useRef<string | null>(null);

  const uid = useId();
  const listId = `${ids.controlId}-listbox-${uid}`;
  const typeahead = useTypeahead();

  const selectedIndex = useMemo(
    () => options.findIndex((option) => option.value === value),
    [options, value],
  );
  const selectedOption = selectedIndex >= 0 ? options[selectedIndex] : undefined;
  const labels = useMemo(() => options.map((option) => option.label), [options]);
  const isEnabled = useCallback((index: number) => !options[index]?.disabled, [options]);

  // The popup is never narrower than the trigger it fell out of.
  useLayoutEffect(() => {
    if (open) setPopupMinWidth(triggerRef.current?.offsetWidth ?? 0);
  }, [open]);

  const position = useAnchorPosition(triggerRef, popupRef, open, 'bottom-start');

  const openPopup = (): void => {
    if (open) return;
    valueAtOpenRef.current = value;
    setOpen(true);
  };

  const close = useCallback(() => setOpen(false), []);
  const inside = useMemo(() => [popupRef, triggerRef], []);
  useDismissable({ onDismiss: close, inside, enabled: open });

  const commitIndex = (index: number): void => {
    if (index < 0 || index >= options.length) return;
    setValue(options[index].value);
  };

  const step = (move: ActiveIndexMove): void => {
    openPopup();
    const next = reduceActiveIndex(selectedIndex, move, options.length, isEnabled);
    if (next >= 0 && next !== selectedIndex) commitIndex(next);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>): void => {
    if (disabled) return;
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        event.preventDefault();
        // Alt+arrow is the pure open/close, no value movement.
        if (event.altKey) {
          if (open) close();
          else openPopup();
          break;
        }
        step(event.key === 'ArrowDown' ? 'next' : 'prev');
        break;
      }
      case 'Home':
        event.preventDefault();
        step('first');
        break;
      case 'End':
        event.preventDefault();
        step('last');
        break;
      case ' ':
      case 'Enter':
        event.preventDefault();
        if (open) close();
        else openPopup();
        break;
      case 'Escape':
        if (open) {
          event.preventDefault();
          event.stopPropagation();
          setValue(valueAtOpenRef.current);
          close();
        }
        break;
      case 'Tab':
        // The committed value stands; Tab just leaves the counter.
        if (open) close();
        break;
      default: {
        if (event.key.length !== 1 || event.ctrlKey || event.metaKey || event.altKey) return;
        // Keep typeahead characters from reaching host hotkeys (Storybook
        // manager binds bare letters); a span trigger has no input shielding.
        event.preventDefault();
        event.stopPropagation();
        const match = typeahead(event.key, labels, selectedIndex, isEnabled);
        if (match >= 0) {
          openPopup();
          commitIndex(match);
        }
      }
    }
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
        <button
          ref={triggerRef}
          type="button"
          id={ids.controlId}
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={
            open && selectedIndex >= 0 ? listBoxOptionId(listId, selectedIndex) : undefined
          }
          aria-invalid={ids.invalid || undefined}
          aria-describedby={ids.describedBy}
          aria-required={required || undefined}
          disabled={disabled}
          className={cx(
            'sc-select__trigger',
            ids.invalid && 'sc-select__trigger--invalid',
            open && 'sc-select__trigger--open',
          )}
          onClick={() => {
            if (open) close();
            else openPopup();
          }}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            if (open) close();
          }}
        >
          <span
            className={cx('sc-select__value', !selectedOption && 'sc-select__value--placeholder')}
          >
            {selectedOption?.label ?? placeholder}
          </span>
          <PixelIcon name="chevron-down" size={16} className="sc-select__chevron" />
        </button>
      </FieldShell>
      {open && (
        <Portal>
          <div
            ref={popupRef}
            className="sc-select__popup"
            style={{
              top: position?.top ?? 0,
              left: position?.left ?? 0,
              minWidth: popupMinWidth || undefined,
              visibility: position ? undefined : 'hidden',
            }}
            // Options must not steal DOM focus from the trigger.
            onMouseDown={(event) => event.preventDefault()}
          >
            <ListBox
              id={listId}
              variant="popup"
              focusable={false}
              options={options}
              selected={value !== null ? [value] : []}
              activeIndex={selectedIndex}
              onSelectionChange={(next) => {
                if (next.length > 0) setValue(next[0]);
              }}
              onOptionPress={() => close()}
              aria-labelledby={label !== undefined ? ids.labelId : undefined}
            />
          </div>
        </Portal>
      )}
    </>
  );
}
