/*
 * ColorField: hex entry on the standard field chassis. A 16px swatch plate
 * rides inside the well showing the paint live as the clerk types; commit
 * happens on blur or Enter, where #RGB expands to #RRGGBB and everything is
 * uppercased. An entry that is not a colour is not argued with: the field
 * reverts to the last lawful value and files a soft error underneath.
 */

import {
  useState,
  type ChangeEvent,
  type CSSProperties,
  type JSX,
  type KeyboardEvent,
} from 'react';
import { cx } from '../../lib/cx';
import { useControllableState } from '../../lib/useControllableState';
import { FieldShell, useFieldIds, type FieldBaseProps } from '../TextField';
import { Swatch } from '../Swatch';
import { normalizeHex } from '../Swatch/colorMath';
import './ColorField.css';

export interface ColorFieldProps extends FieldBaseProps {
  /** Committed colour, always normalized "#RRGGBB". */
  value?: string;
  defaultValue?: string;
  /** Fires with the normalized hex on every successful commit. */
  onValueChange?: (hex: string) => void;
  placeholder?: string;
  name?: string;
  id?: string;
  className?: string;
  style?: CSSProperties;
}

const REVERT_NOTICE = 'NOT A LAWFUL PAINT CODE — ENTRY REVERTED';

export function ColorField({
  label,
  description,
  errorMessage,
  invalid,
  required,
  disabled,
  value: valueProp,
  defaultValue,
  onValueChange,
  placeholder = '#RRGGBB',
  name,
  id,
  className,
  style,
}: ColorFieldProps): JSX.Element {
  const [value, setValue] = useControllableState(
    valueProp,
    normalizeHex(defaultValue ?? '') ?? '#FFFFFF',
    onValueChange,
  );
  /** In-progress text while focused; null means "show the committed value". */
  const [draft, setDraft] = useState<string | null>(null);
  const [softError, setSoftError] = useState<string | null>(null);

  const shownError = errorMessage ?? softError;
  const ids = useFieldIds({ id, description, errorMessage: shownError, invalid });

  const text = draft ?? value;
  /* The plate previews the draft the moment it parses; otherwise it holds
     the last committed paint. */
  const preview = normalizeHex(text) ?? value;

  function commit(raw: string): string {
    const norm = normalizeHex(raw);
    if (norm !== null) {
      setValue(norm);
      setSoftError(null);
      return norm;
    }
    setSoftError(REVERT_NOTICE);
    return value;
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>): void {
    setDraft(event.target.value);
    setSoftError(null);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      setDraft(commit(text));
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setDraft(value);
      setSoftError(null);
    }
  }

  return (
    <FieldShell
      ids={ids}
      label={label}
      description={description}
      errorMessage={shownError}
      required={required}
      disabled={disabled}
      className={className}
      style={style}
    >
      <div
        className={cx(
          'sc-colorfield',
          disabled && 'sc-colorfield--disabled',
          ids.invalid && 'sc-colorfield--invalid',
        )}
      >
        <Swatch color={preview} size={16} label={`Current paint ${preview}`} />
        <input
          id={ids.controlId}
          className="sc-colorfield__input"
          type="text"
          name={name}
          value={text}
          placeholder={placeholder}
          onChange={handleChange}
          onFocus={() => {
            if (draft === null) setDraft(value);
          }}
          onBlur={() => {
            commit(text);
            setDraft(null);
          }}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          required={required}
          spellCheck={false}
          autoComplete="off"
          autoCapitalize="off"
          aria-invalid={ids.invalid || undefined}
          aria-describedby={ids.describedBy}
        />
      </div>
    </FieldShell>
  );
}
