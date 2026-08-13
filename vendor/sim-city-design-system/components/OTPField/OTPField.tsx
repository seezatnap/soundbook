import {
  useRef,
  type ChangeEvent,
  type ClipboardEvent,
  type CSSProperties,
  type FocusEvent,
  type JSX,
  type KeyboardEvent,
} from 'react';
import { cx } from '../../lib/cx';
import { useControllableState } from '../../lib/useControllableState';
import { FieldShell, useFieldIds, type FieldBaseProps } from '../TextField';
import './OTPField.css';

export interface OTPFieldProps extends FieldBaseProps {
  /** How many boxes the code occupies. */
  length?: number;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Fires the moment every box is filled. */
  onComplete?: (code: string) => void;
  /** Show a filled block instead of the digit. */
  mask?: boolean;
  id?: string;
  /** Names the group when there is no visible label. */
  'aria-label'?: string;
  autoFocus?: boolean;
  className?: string;
  style?: CSSProperties;
}

export function OTPField({
  length = 6,
  value: valueProp,
  defaultValue = '',
  onValueChange,
  onComplete,
  mask = false,
  label,
  description,
  errorMessage,
  invalid,
  required,
  disabled,
  id,
  autoFocus,
  className,
  style,
  'aria-label': ariaLabel,
}: OTPFieldProps): JSX.Element {
  const ids = useFieldIds({ id, description, errorMessage, invalid });
  const [value, setValue] = useControllableState(valueProp, defaultValue, onValueChange);
  const boxes = useRef<Array<HTMLInputElement | null>>([]);

  /* The code is kept dense — there are no holes in the middle of a confirmation
     number — so focus never lands past the first empty box and every edit is
     either a replacement or an append. */
  const focusBox = (index: number): void => {
    const clamped = Math.max(0, Math.min(index, length - 1));
    const el = boxes.current[clamped];
    el?.focus();
    el?.select();
  };

  const commit = (next: string): void => {
    const code = next.slice(0, length);
    setValue(code);
    if (code.length === length) onComplete?.(code);
  };

  const handleChange = (index: number) => (event: ChangeEvent<HTMLInputElement>): void => {
    const digits = event.target.value.replace(/\D/g, '');
    if (digits.length === 0) {
      commit(value.slice(0, index) + value.slice(index + 1));
      return;
    }
    // Typing over a box that still holds its old digit hands us both of them.
    const existing = value[index] ?? '';
    const incoming = digits.length > 1 && digits[0] === existing ? digits.slice(1) : digits;
    if (incoming.length === 1) {
      commit(value.slice(0, index) + incoming + value.slice(index + 1));
      focusBox(index + 1);
      return;
    }
    const next = (value.slice(0, index) + incoming).slice(0, length);
    commit(next);
    focusBox(next.length);
  };

  const handleKeyDown = (index: number) => (event: KeyboardEvent<HTMLInputElement>): void => {
    switch (event.key) {
      case 'Backspace':
        event.preventDefault();
        if (value[index]) {
          commit(value.slice(0, index) + value.slice(index + 1));
          focusBox(index);
        } else if (index > 0) {
          commit(value.slice(0, index - 1) + value.slice(index));
          focusBox(index - 1);
        }
        break;
      case 'Delete':
        event.preventDefault();
        commit(value.slice(0, index) + value.slice(index + 1));
        break;
      case 'ArrowLeft':
        event.preventDefault();
        focusBox(index - 1);
        break;
      case 'ArrowRight':
        event.preventDefault();
        focusBox(index + 1);
        break;
      case 'Home':
        event.preventDefault();
        focusBox(0);
        break;
      case 'End':
        event.preventDefault();
        focusBox(value.length);
        break;
      default:
        break;
    }
  };

  const handleFocus = (index: number) => (event: FocusEvent<HTMLInputElement>): void => {
    if (index > value.length) {
      focusBox(value.length);
      return;
    }
    event.target.select();
  };

  const handlePaste = (index: number) => (event: ClipboardEvent<HTMLInputElement>): void => {
    event.preventDefault();
    const digits = event.clipboardData.getData('text').replace(/\D/g, '');
    if (digits === '') return;
    const next = (value.slice(0, index) + digits).slice(0, length);
    commit(next);
    focusBox(next.length);
  };

  const hasLabel = label !== undefined && label !== null && label !== '' && label !== false;

  return (
    <FieldShell
      ids={ids}
      label={label}
      description={description}
      errorMessage={errorMessage}
      required={required}
      disabled={disabled}
      labelFor={false}
      className={className}
      style={style}
    >
      <div
        className={cx('sc-otpfield', ids.invalid && 'sc-otpfield--invalid')}
        role="group"
        aria-labelledby={hasLabel ? ids.labelId : undefined}
        aria-label={hasLabel ? undefined : (ariaLabel ?? 'One-time code')}
        aria-describedby={ids.describedBy}
      >
        {Array.from({ length }, (_, index) => {
          const char = value[index] ?? '';
          return (
            <input
              key={index}
              ref={(el) => {
                boxes.current[index] = el;
              }}
              id={index === 0 ? ids.controlId : undefined}
              className="sc-otpfield__box"
              type="text"
              inputMode="numeric"
              autoComplete={index === 0 ? 'one-time-code' : 'off'}
              autoFocus={autoFocus && index === 0}
              aria-label={`Digit ${index + 1} of ${length}`}
              aria-invalid={ids.invalid || undefined}
              value={mask && char !== '' ? '■' : char}
              disabled={disabled}
              required={required}
              onChange={handleChange(index)}
              onKeyDown={handleKeyDown(index)}
              onFocus={handleFocus(index)}
              onPaste={handlePaste(index)}
            />
          );
        })}
      </div>
    </FieldShell>
  );
}
