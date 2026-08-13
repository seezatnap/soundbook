/*
 * A DateField with the calendar bolted to the end of the well. The trigger is
 * an IconButton in spirit but drawn at 22px — the exact interior of the well —
 * so the field stays one icon-row tall. Picking a day files it, closes the
 * popover, and hands focus back to the button; Escape does the same without
 * filing anything. Typing in the segments stays live the whole time, and the
 * open grid pages along with whatever is typed.
 */

import { useRef } from 'react';
import type { ComponentPropsWithRef, CSSProperties, JSX, Ref } from 'react';
import { Calendar, type CalendarDate } from '../Calendar';
import { DateField } from '../DateField';
import { Popover } from '../Popover';
import type { FieldBaseProps } from '../TextField';
import { PixelIcon } from '../../icons/PixelIcon';
import { cx } from '../../lib/cx';
import { useControllableState } from '../../lib/useControllableState';
import './DatePicker.css';

export type PickerButtonProps = Omit<ComponentPropsWithRef<'button'>, 'children'>;

/**
 * The 22px calendar-glyph trigger that lives inside a segmented well.
 * Exported so DateRangePicker mounts the identical button on its END field.
 */
export function PickerButton({ className, type = 'button', ...rest }: PickerButtonProps): JSX.Element {
  return (
    <button type={type} className={cx('sc-datepicker__trigger', className)} {...rest}>
      <PixelIcon name="calendar" size={16} />
    </button>
  );
}

function applyRef(ref: Ref<HTMLElement>, node: HTMLElement | null): void {
  if (typeof ref === 'function') ref(node);
  else if (ref != null) ref.current = node;
}

export interface DatePickerProps extends FieldBaseProps {
  value?: CalendarDate | null;
  defaultValue?: CalendarDate | null;
  onValueChange?: (value: CalendarDate | null) => void;
  min?: CalendarDate;
  max?: CalendarDate;
  isDateDisabled?: (date: CalendarDate) => boolean;
  weekStartsOn?: 0 | 1;
  locale?: string;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  id?: string;
  'aria-label'?: string;
  className?: string;
  style?: CSSProperties;
}

export function DatePicker({
  label,
  description,
  errorMessage,
  invalid,
  required,
  disabled,
  value: valueProp,
  defaultValue,
  onValueChange,
  min,
  max,
  isDateDisabled,
  weekStartsOn,
  locale,
  open: openProp,
  defaultOpen,
  onOpenChange,
  id,
  'aria-label': ariaLabel,
  className,
  style,
}: DatePickerProps): JSX.Element {
  const [value, setValue] = useControllableState<CalendarDate | null>(
    valueProp,
    defaultValue ?? null,
    onValueChange,
  );
  const [open, setOpen] = useControllableState(openProp, defaultOpen ?? false, onOpenChange);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  const pick = (picked: CalendarDate): void => {
    setValue(picked);
    setOpen(false);
    buttonRef.current?.focus();
  };

  return (
    <DateField
      label={label}
      description={description}
      errorMessage={errorMessage}
      invalid={invalid}
      required={required}
      disabled={disabled}
      locale={locale}
      id={id}
      aria-label={ariaLabel}
      className={className}
      style={style}
      value={value}
      onValueChange={setValue}
      suffix={
        <Popover
          open={open}
          onOpenChange={setOpen}
          placement="bottom-end"
          gap={4}
          trigger={(triggerProps) => (
            <PickerButton
              ref={(node: HTMLButtonElement | null) => {
                applyRef(triggerProps.ref, node);
                buttonRef.current = node;
              }}
              onClick={triggerProps.onClick}
              onKeyDown={triggerProps.onKeyDown}
              aria-expanded={triggerProps['aria-expanded']}
              aria-haspopup={triggerProps['aria-haspopup']}
              aria-label="Open calendar"
              disabled={disabled}
            />
          )}
        >
          <Calendar
            autoFocus
            value={value}
            min={min}
            max={max}
            isDateDisabled={isDateDisabled}
            weekStartsOn={weekStartsOn}
            locale={locale}
            onValueChange={pick}
          />
        </Popover>
      }
    />
  );
}
