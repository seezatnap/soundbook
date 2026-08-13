/*
 * RadioGroup: the APG radio pattern, hand-rolled. One tab stop for the whole
 * group (roving tabindex), arrows move focus AND selection, Home/End jump to
 * the rails, Space confirms the focused item.
 *
 * There are no circles in this system, so a radio is not a dot in a ring:
 * it is a sunken 16px plate whose checked state is a lit 6px accent core,
 * inset 3px inside the well. A checkbox fills with a glyph; a radio lights
 * up. The two read differently at arm's length, which is the whole point.
 *
 * The roving tab stop is maintained imperatively from the group (one pass
 * over the rendered radios after each render) so an item never has to know
 * whether it happens to be first-enabled.
 */

import {
  createContext,
  useContext,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  type JSX,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { cx } from '../../lib/cx';
import { useControllableState } from '../../lib/useControllableState';
import './RadioGroup.css';

interface RadioGroupContextValue {
  value: string | null;
  select: (value: string) => void;
  disabled: boolean;
}

const RadioGroupContext = createContext<RadioGroupContextValue | null>(null);

export interface RadioGroupProps {
  /** Uppercase dim band above the plates. */
  label: ReactNode;
  /** Radio children (wrappers between them are fine). */
  children: ReactNode;
  /** Controlled value; pass null for "nothing selected yet". */
  value?: string | null;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  orientation?: 'vertical' | 'horizontal';
  description?: ReactNode;
  errorMessage?: ReactNode;
  disabled?: boolean;
  className?: string;
}

export function RadioGroup({
  label,
  children,
  value: valueProp,
  defaultValue,
  onValueChange,
  orientation = 'vertical',
  description,
  errorMessage,
  disabled = false,
  className,
}: RadioGroupProps): JSX.Element {
  const [value, setValue] = useControllableState<string | null>(
    valueProp,
    defaultValue ?? null,
    (next) => {
      if (next !== null) onValueChange?.(next);
    },
  );

  const context = useMemo<RadioGroupContextValue>(
    () => ({ value, select: setValue, disabled }),
    [value, setValue, disabled],
  );

  const groupRef = useRef<HTMLDivElement>(null);
  const labelId = useId();
  const descriptionId = useId();
  const errorId = useId();
  const describedBy =
    [description ? descriptionId : null, errorMessage ? errorId : null]
      .filter(Boolean)
      .join(' ') || undefined;

  function enabledRadios(): HTMLElement[] {
    const root = groupRef.current;
    if (!root) return [];
    return Array.from(root.querySelectorAll<HTMLElement>('[role="radio"]')).filter(
      (el) => el.getAttribute('aria-disabled') !== 'true',
    );
  }

  /*
   * The roving tab stop: exactly one radio is tabbable — the checked one,
   * or the first enabled one when nothing is checked yet. Recomputed after
   * every render of the group (selection always re-renders the provider).
   */
  useLayoutEffect(() => {
    const root = groupRef.current;
    if (!root) return;
    const radios = Array.from(root.querySelectorAll<HTMLElement>('[role="radio"]'));
    const enabled = radios.filter((el) => el.getAttribute('aria-disabled') !== 'true');
    const checked = enabled.find((el) => el.getAttribute('aria-checked') === 'true');
    const stop = checked ?? enabled[0];
    for (const el of radios) el.tabIndex = el === stop ? 0 : -1;
  });

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    const origin = (event.target as HTMLElement).closest<HTMLElement>('[role="radio"]');
    if (!origin) return;
    const radios = enabledRadios();
    const index = radios.indexOf(origin);
    if (index < 0 || radios.length === 0) return;

    let next: HTMLElement | undefined;
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        next = radios[(index + 1) % radios.length];
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        next = radios[(index - 1 + radios.length) % radios.length];
        break;
      case 'Home':
        next = radios[0];
        break;
      case 'End':
        next = radios[radios.length - 1];
        break;
      case ' ':
        event.preventDefault();
        if (origin.dataset.value !== undefined) setValue(origin.dataset.value);
        return;
      default:
        return;
    }
    event.preventDefault();
    if (next) {
      next.focus();
      if (next.dataset.value !== undefined) setValue(next.dataset.value);
    }
  }

  return (
    <div
      className={cx('sc-radio-group', disabled && 'sc-radio-group--disabled', className)}
    >
      <div className="sc-radio-group__label" id={labelId}>
        {label}
      </div>
      {description !== undefined && (
        <div className="sc-radio-group__description" id={descriptionId}>
          {description}
        </div>
      )}
      <div
        ref={groupRef}
        role="radiogroup"
        aria-labelledby={labelId}
        aria-describedby={describedBy}
        aria-invalid={errorMessage ? true : undefined}
        aria-orientation={orientation}
        onKeyDown={disabled ? undefined : handleKeyDown}
        className={cx(
          'sc-radio-group__items',
          orientation === 'horizontal' && 'sc-radio-group__items--horizontal',
        )}
      >
        <RadioGroupContext.Provider value={context}>{children}</RadioGroupContext.Provider>
      </div>
      {errorMessage !== undefined && (
        <div className="sc-radio-group__error" id={errorId}>
          {errorMessage}
        </div>
      )}
    </div>
  );
}

export interface RadioProps {
  value: string;
  /** Sits to the right of the plate; clicking it selects. */
  label: ReactNode;
  /** Secondary line under the label, dim ink, wired via aria-describedby. */
  description?: ReactNode;
  disabled?: boolean;
  className?: string;
}

export function Radio({ value, label, description, disabled = false, className }: RadioProps): JSX.Element {
  const groupContext = useContext(RadioGroupContext);
  if (groupContext === null) {
    throw new Error('Radio must be rendered inside a RadioGroup.');
  }
  const group = groupContext;
  const checked = group.value === value;
  const isDisabled = disabled || group.disabled;
  const labelId = useId();
  const descriptionId = useId();

  function handleClick(event: MouseEvent<HTMLSpanElement>): void {
    if (isDisabled) return;
    // Safari does not always focus tabindex elements on click; insist.
    event.currentTarget.focus();
    group.select(value);
  }

  return (
    <span
      role="radio"
      aria-checked={checked}
      aria-disabled={isDisabled || undefined}
      aria-labelledby={labelId}
      aria-describedby={description ? descriptionId : undefined}
      data-value={value}
      onClick={handleClick}
      className={cx(
        'sc-radio',
        checked && 'sc-radio--checked',
        isDisabled && 'sc-radio--disabled',
        className,
      )}
    >
      <span className="sc-radio__plate" aria-hidden="true">
        {checked && <span className="sc-radio__core" />}
      </span>
      <span className="sc-radio__text">
        <span className="sc-radio__label" id={labelId}>
          {label}
        </span>
        {description !== undefined && (
          <span className="sc-radio__description" id={descriptionId}>
            {description}
          </span>
        )}
      </span>
    </span>
  );
}
