import type { ChangeEvent, ComponentPropsWithRef, CSSProperties, JSX } from 'react';
import { cx } from '../../lib/cx';
import { useControllableState } from '../../lib/useControllableState';
import { FieldShell, useFieldIds, type FieldBaseProps } from '../TextField';
import './TextArea.css';

type NativeTextAreaProps = Omit<
  ComponentPropsWithRef<'textarea'>,
  'value' | 'defaultValue' | 'className' | 'style'
>;

export interface TextAreaProps extends NativeTextAreaProps, FieldBaseProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Visible lines. The box is fixed at this height — it does not stretch. */
  rows?: number;
  className?: string;
  style?: CSSProperties;
}

export function TextArea({
  label,
  description,
  errorMessage,
  invalid,
  required,
  disabled,
  value: valueProp,
  defaultValue = '',
  onValueChange,
  onChange,
  rows = 4,
  className,
  style,
  id,
  ...rest
}: TextAreaProps): JSX.Element {
  const ids = useFieldIds({ id, description, errorMessage, invalid });
  const [value, setValue] = useControllableState(valueProp, defaultValue, onValueChange);

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>): void => {
    setValue(event.target.value);
    onChange?.(event);
  };

  const describedBy = [rest['aria-describedby'], ids.describedBy].filter(Boolean).join(' ');

  return (
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
      <textarea
        {...rest}
        id={ids.controlId}
        className={cx('sc-textarea__input', ids.invalid && 'sc-textarea__input--invalid')}
        rows={rows}
        value={value}
        onChange={handleChange}
        disabled={disabled}
        required={required}
        aria-invalid={ids.invalid || undefined}
        aria-describedby={describedBy || undefined}
      />
    </FieldShell>
  );
}
