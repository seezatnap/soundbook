/*
 * The shared anatomy of every field: a label band above, the control, and the
 * two lines a form is allowed to say about it underneath. Drawing it once here
 * is what makes a stack of unrelated inputs read as a single municipal form.
 *
 * Fields differ only in what sits in the middle, so everything else — the
 * uppercase label, the accent asterisk, the stamped error mark — is settled
 * here and never re-argued by an individual control.
 */

import type { CSSProperties, JSX, ReactNode } from 'react';
import { cx } from '../../lib/cx';
import { isPresent, type FieldBaseProps, type FieldIds } from './useFieldIds';
import './FieldShell.css';

export interface FieldShellProps extends FieldBaseProps {
  ids: FieldIds;
  /**
   * Which element the label points at. `false` renders the label as a plain
   * span for composite controls (an OTP row has no single labelable input);
   * the group then references `ids.labelId` with `aria-labelledby`.
   */
  labelFor?: string | false;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}

export function FieldShell({
  ids,
  label,
  description,
  errorMessage,
  required,
  disabled,
  labelFor,
  className,
  style,
  children,
}: FieldShellProps): JSX.Element {
  const mark = required ? (
    <span className="sc-field__required" aria-hidden="true">
      {' *'}
    </span>
  ) : null;

  return (
    <div
      className={cx(
        'sc-field',
        disabled && 'sc-field--disabled',
        ids.invalid && 'sc-field--invalid',
        className,
      )}
      style={style}
    >
      {isPresent(label) &&
        (labelFor === false ? (
          <span className="sc-field__label" id={ids.labelId}>
            {label}
            {mark}
          </span>
        ) : (
          <label className="sc-field__label" id={ids.labelId} htmlFor={labelFor ?? ids.controlId}>
            {label}
            {mark}
          </label>
        ))}

      <div className="sc-field__control">{children}</div>

      {isPresent(description) && (
        <p className="sc-field__description" id={ids.descriptionId}>
          {description}
        </p>
      )}

      {isPresent(errorMessage) && (
        <p className="sc-field__error" id={ids.errorId}>
          <span className="sc-field__error-mark" aria-hidden="true">
            !
          </span>
          <span>{errorMessage}</span>
        </p>
      )}
    </div>
  );
}
