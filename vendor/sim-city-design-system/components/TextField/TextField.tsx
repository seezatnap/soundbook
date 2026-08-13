import type { ChangeEvent, ComponentPropsWithRef, CSSProperties, JSX, ReactNode } from 'react';
import { PixelIcon, type PixelIconName } from '../../icons/PixelIcon';
import { cx } from '../../lib/cx';
import { useControllableState } from '../../lib/useControllableState';
import { FieldShell } from './FieldShell';
import { useFieldIds, type FieldBaseProps } from './useFieldIds';
import './TextField.css';

type NativeInputProps = Omit<
  ComponentPropsWithRef<'input'>,
  'value' | 'defaultValue' | 'prefix' | 'className' | 'style'
>;

export interface TextFieldProps extends NativeInputProps, FieldBaseProps {
  value?: string;
  defaultValue?: string;
  /** Fires with the new text; the native `onChange` still fires as well. */
  onValueChange?: (value: string) => void;
  /** Dim text before the input — a unit, a currency mark, a form number. */
  prefix?: ReactNode;
  /** Dim text or controls after the input. */
  suffix?: ReactNode;
  /** Leading pixel glyph, inside the well. */
  icon?: PixelIconName;
  /** Applied to the field block, not the input: the field is the component. */
  className?: string;
  style?: CSSProperties;
}

export function TextField({
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
  prefix,
  suffix,
  icon,
  className,
  style,
  id,
  ...rest
}: TextFieldProps): JSX.Element {
  const ids = useFieldIds({ id, description, errorMessage, invalid });
  const [value, setValue] = useControllableState(valueProp, defaultValue, onValueChange);

  const handleChange = (event: ChangeEvent<HTMLInputElement>): void => {
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
      <div
        className={cx(
          'sc-textfield',
          disabled && 'sc-textfield--disabled',
          ids.invalid && 'sc-textfield--invalid',
        )}
      >
        {icon ? <PixelIcon name={icon} size={16} className="sc-textfield__icon" /> : null}
        {prefix !== undefined && prefix !== null ? (
          <span className="sc-textfield__affix">{prefix}</span>
        ) : null}
        <input
          {...rest}
          id={ids.controlId}
          className="sc-textfield__input"
          value={value}
          onChange={handleChange}
          disabled={disabled}
          required={required}
          aria-invalid={ids.invalid || undefined}
          aria-describedby={describedBy || undefined}
        />
        {suffix !== undefined && suffix !== null ? (
          <span className="sc-textfield__affix">{suffix}</span>
        ) : null}
      </div>
    </FieldShell>
  );
}
