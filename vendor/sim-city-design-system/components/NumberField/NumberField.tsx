import {
  useMemo,
  useState,
  type FocusEvent,
  type JSX,
  type KeyboardEvent,
  type MouseEvent,
} from 'react';
import { useControllableState } from '../../lib/useControllableState';
import { TextField, type TextFieldProps } from '../TextField';
import './NumberField.css';

/*
 * The stepper interior is 12x7 after its bevel — a 16-grid registry glyph
 * clips to noise in there, so the arrows are drawn at their true size:
 * a stepped 7x4 pixel triangle, one rect per row, crisp at 1x.
 */
const ARROW_ROWS: Array<[number, number]> = [
  [3, 1],
  [2, 3],
  [1, 5],
  [0, 7],
];

function StepArrow({ direction }: { direction: 'up' | 'down' }): JSX.Element {
  return (
    <svg
      width={7}
      height={4}
      viewBox="0 0 7 4"
      shapeRendering="crispEdges"
      aria-hidden="true"
      focusable="false"
      style={{ display: 'block' }}
    >
      {ARROW_ROWS.map(([x, w], row) => (
        <rect
          key={row}
          x={x}
          y={direction === 'up' ? row : 3 - row}
          width={w}
          height={1}
          fill="currentColor"
        />
      ))}
    </svg>
  );
}

export interface NumberFieldProps
  extends Omit<
    TextFieldProps,
    'value' | 'defaultValue' | 'onValueChange' | 'type' | 'suffix' | 'inputMode' | 'role'
  > {
  value?: number | null;
  defaultValue?: number | null;
  /** Fires with the parsed number, or null when the field is empty. */
  onValueChange?: (value: number | null) => void;
  min?: number;
  max?: number;
  /** Arrow-key and stepper increment. Shift multiplies it by ten. */
  step?: number;
  /** Applied on blur and on every step, never while typing. */
  formatOptions?: Intl.NumberFormatOptions;
}

function decimalsOf(n: number): number {
  const text = String(n);
  const dot = text.indexOf('.');
  return dot === -1 ? 0 : text.length - dot - 1;
}

/** Reads back whatever survived the user, the formatter, and the unit marks. */
function parseNumber(text: string): number | null {
  const cleaned = text.replace(/[^0-9.-]/g, '');
  if (cleaned === '' || cleaned === '-' || cleaned === '.') return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

export function NumberField({
  value: valueProp,
  defaultValue = null,
  onValueChange,
  min,
  max,
  step = 1,
  formatOptions,
  disabled,
  onKeyDown,
  onBlur,
  ...rest
}: NumberFieldProps): JSX.Element {
  const [value, setValue] = useControllableState<number | null>(
    valueProp,
    defaultValue,
    onValueChange,
  );
  /** Non-null only while the user is mid-edit; the committed value is the truth. */
  const [draft, setDraft] = useState<string | null>(null);

  const formatter = useMemo(
    () => (formatOptions ? new Intl.NumberFormat(undefined, formatOptions) : undefined),
    [formatOptions],
  );
  const format = (n: number | null): string =>
    n === null ? '' : formatter ? formatter.format(n) : String(n);

  const text = draft ?? format(value);
  const clamp = (n: number): number => {
    let next = n;
    if (min !== undefined && next < min) next = min;
    if (max !== undefined && next > max) next = max;
    return next;
  };

  const commit = (next: number | null): void => {
    setDraft(null);
    setValue(next === null ? null : clamp(next));
  };

  const stepBy = (direction: 1 | -1, multiplier: number): void => {
    const base = parseNumber(text);
    const delta = step * multiplier * direction;
    const next = base === null ? clamp(min ?? 0) : clamp(base + delta);
    const precision = Math.min(Math.max(decimalsOf(step), decimalsOf(base ?? 0)), 10);
    commit(Number(next.toFixed(precision)));
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    onKeyDown?.(event);
    if (event.defaultPrevented || disabled) return;
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      stepBy(1, event.shiftKey ? 10 : 1);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      stepBy(-1, event.shiftKey ? 10 : 1);
    }
  };

  const handleBlur = (event: FocusEvent<HTMLInputElement>): void => {
    // Leaving the field is where a half-typed number becomes a filed one.
    commit(parseNumber(text));
    onBlur?.(event);
  };

  // Keep the caret where it is: the steppers are a nudge, not a focus change.
  const holdFocus = (event: MouseEvent<HTMLButtonElement>): void => event.preventDefault();

  const current = parseNumber(text);
  const atMax = max !== undefined && current !== null && current >= max;
  const atMin = min !== undefined && current !== null && current <= min;

  return (
    <TextField
      autoComplete="off"
      {...rest}
      disabled={disabled}
      inputMode="decimal"
      value={text}
      onValueChange={setDraft}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
      role="spinbutton"
      aria-valuenow={value ?? undefined}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuetext={formatter && value !== null ? format(value) : undefined}
      suffix={
        <span className="sc-numberfield__steppers">
          <button
            type="button"
            className="sc-numberfield__stepper"
            tabIndex={-1}
            aria-label="Increase value"
            disabled={disabled || atMax}
            onMouseDown={holdFocus}
            onClick={(event) => stepBy(1, event.shiftKey ? 10 : 1)}
          >
            <StepArrow direction="up" />
          </button>
          <button
            type="button"
            className="sc-numberfield__stepper"
            tabIndex={-1}
            aria-label="Decrease value"
            disabled={disabled || atMin}
            onMouseDown={holdFocus}
            onClick={(event) => stepBy(-1, event.shiftKey ? 10 : 1)}
          >
            <StepArrow direction="down" />
          </button>
        </span>
      }
    />
  );
}
