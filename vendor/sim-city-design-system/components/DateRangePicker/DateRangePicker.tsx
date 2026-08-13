/*
 * START – END: two segmented wells and one calendar button between the clerk
 * and a fortnight of jackhammers. Each end types independently — a half-set
 * window is a legal draft — while the button opens a RangeCalendar that files
 * both ends at once and hands focus back when it is done.
 */

import { useRef } from 'react';
import type { CSSProperties, JSX, Ref } from 'react';
import { compareCalendarDates, type CalendarDate } from '../Calendar';
import { DateField } from '../DateField';
import { PickerButton } from '../DatePicker';
import { Popover } from '../Popover';
import { RangeCalendar, type CalendarDateRange } from '../RangeCalendar';
import { FieldShell, useFieldIds, type FieldBaseProps } from '../TextField';
import { useControllableState } from '../../lib/useControllableState';
import './DateRangePicker.css';

/** Either end may be blank; a complete window has both stamps. */
export interface DateRange {
  start: CalendarDate | null;
  end: CalendarDate | null;
}

export interface DateRangePickerProps extends FieldBaseProps {
  value?: DateRange;
  defaultValue?: DateRange;
  onValueChange?: (value: DateRange) => void;
  min?: CalendarDate;
  max?: CalendarDate;
  isDateDisabled?: (date: CalendarDate) => boolean;
  weekStartsOn?: 0 | 1;
  locale?: string;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  id?: string;
  /** Names the group when there is no visible label. */
  'aria-label'?: string;
  className?: string;
  style?: CSSProperties;
}

const EMPTY_RANGE: DateRange = { start: null, end: null };

function applyRef(ref: Ref<HTMLElement>, node: HTMLElement | null): void {
  if (typeof ref === 'function') ref(node);
  else if (ref != null) ref.current = node;
}

export function DateRangePicker({
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
}: DateRangePickerProps): JSX.Element {
  const ids = useFieldIds({ id, description, errorMessage, invalid });
  const [value, setValue] = useControllableState<DateRange>(
    valueProp,
    defaultValue ?? EMPTY_RANGE,
    onValueChange,
  );
  const [open, setOpen] = useControllableState(openProp, defaultOpen ?? false, onOpenChange);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  // The grid only understands a complete, ordered window.
  const committed: CalendarDateRange | null =
    value.start && value.end
      ? compareCalendarDates(value.start, value.end) <= 0
        ? { start: value.start, end: value.end }
        : { start: value.end, end: value.start }
      : null;

  const pick = (range: CalendarDateRange): void => {
    setValue({ start: range.start, end: range.end });
    setOpen(false);
    buttonRef.current?.focus();
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
        className="sc-daterangepicker"
        role="group"
        id={ids.controlId}
        aria-labelledby={hasLabel ? ids.labelId : undefined}
        aria-label={hasLabel ? undefined : (ariaLabel ?? 'Date range')}
        aria-describedby={ids.describedBy}
      >
        <DateField
          className="sc-daterangepicker__field"
          aria-label="Start date"
          locale={locale}
          disabled={disabled}
          required={required}
          invalid={ids.invalid}
          value={value.start}
          onValueChange={(date) => setValue({ start: date, end: value.end })}
        />
        <span className="sc-daterangepicker__dash" aria-hidden="true">
          –
        </span>
        <DateField
          className="sc-daterangepicker__field"
          aria-label="End date"
          locale={locale}
          disabled={disabled}
          required={required}
          invalid={ids.invalid}
          value={value.end}
          onValueChange={(date) => setValue({ start: value.start, end: date })}
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
                  aria-label="Open range calendar"
                  disabled={disabled}
                />
              )}
            >
              <RangeCalendar
                autoFocus
                value={committed}
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
      </div>
    </FieldShell>
  );
}
