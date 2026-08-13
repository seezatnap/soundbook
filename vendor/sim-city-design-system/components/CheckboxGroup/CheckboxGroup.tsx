/*
 * CheckboxGroup: a labelled fieldset of Checkboxes sharing one string[] value.
 * The group owns membership; each child Checkbox declares a `value` and reads
 * its state through context. Description and error ride along on
 * aria-describedby so the whole group reports as one field.
 */

import { useCallback, useId, useMemo, type JSX, type ReactNode } from 'react';
import { cx } from '../../lib/cx';
import { useControllableState } from '../../lib/useControllableState';
import { CheckboxGroupContext, type CheckboxGroupContextValue } from '../Checkbox';
import './CheckboxGroup.css';

export interface CheckboxGroupProps {
  /** Uppercase dim band above the boxes. */
  label: ReactNode;
  /** Checkbox children, each carrying a `value`. */
  children: ReactNode;
  value?: string[];
  defaultValue?: string[];
  onValueChange?: (value: string[]) => void;
  orientation?: 'vertical' | 'horizontal';
  description?: ReactNode;
  errorMessage?: ReactNode;
  disabled?: boolean;
  /** Forwarded to every child input for form submission. */
  name?: string;
  className?: string;
}

export function CheckboxGroup({
  label,
  children,
  value: valueProp,
  defaultValue,
  onValueChange,
  orientation = 'vertical',
  description,
  errorMessage,
  disabled = false,
  name,
  className,
}: CheckboxGroupProps): JSX.Element {
  const [value, setValue] = useControllableState<string[]>(
    valueProp,
    defaultValue ?? [],
    onValueChange,
  );

  const toggle = useCallback(
    (itemValue: string) => {
      setValue(
        value.includes(itemValue)
          ? value.filter((v) => v !== itemValue)
          : [...value, itemValue],
      );
    },
    [value, setValue],
  );

  const context = useMemo<CheckboxGroupContextValue>(
    () => ({ value, toggle, disabled, name }),
    [value, toggle, disabled, name],
  );

  const labelId = useId();
  const descriptionId = useId();
  const errorId = useId();
  const describedBy =
    [description ? descriptionId : null, errorMessage ? errorId : null]
      .filter(Boolean)
      .join(' ') || undefined;

  return (
    <div
      role="group"
      aria-labelledby={labelId}
      aria-describedby={describedBy}
      aria-invalid={errorMessage ? true : undefined}
      className={cx(
        'sc-checkbox-group',
        disabled && 'sc-checkbox-group--disabled',
        className,
      )}
    >
      <div className="sc-checkbox-group__label" id={labelId}>
        {label}
      </div>
      {description !== undefined && (
        <div className="sc-checkbox-group__description" id={descriptionId}>
          {description}
        </div>
      )}
      <div
        className={cx(
          'sc-checkbox-group__items',
          orientation === 'horizontal' && 'sc-checkbox-group__items--horizontal',
        )}
      >
        <CheckboxGroupContext.Provider value={context}>{children}</CheckboxGroupContext.Provider>
      </div>
      {errorMessage !== undefined && (
        <div className="sc-checkbox-group__error" id={errorId}>
          {errorMessage}
        </div>
      )}
    </div>
  );
}
