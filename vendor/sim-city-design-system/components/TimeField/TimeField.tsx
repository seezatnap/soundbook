/*
 * HH : MM plus the AM/PM stamp, on the same segment machine as DateField.
 * The value crossing the API is {hour: 0-23, minute} — the 12-hour face is
 * presentation only; the ledger keeps government time.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, JSX, ReactNode } from 'react';
import { FieldShell, useFieldIds, type FieldBaseProps } from '../TextField';
import { SegmentedField, type SegmentItem, type SegmentParts } from '../DateField';
import { PixelIcon } from '../../icons/PixelIcon';
import { useControllableState } from '../../lib/useControllableState';
import './TimeField.css';

export interface TimeValue {
  /** 0-23, whatever the field's face shows. */
  hour: number;
  minute: number;
}

export function timeValueFromDate(date: Date): TimeValue {
  return { hour: date.getHours(), minute: date.getMinutes() };
}

export function nowTimeValue(): TimeValue {
  return timeValueFromDate(new Date());
}

export interface TimeFieldProps extends FieldBaseProps {
  value?: TimeValue | null;
  defaultValue?: TimeValue | null;
  /** Fires with the complete time, or null while the form has blanks. */
  onValueChange?: (value: TimeValue | null) => void;
  /** 12 shows the AM/PM stamp; 24 runs the clock straight through. */
  hourCycle?: 12 | 24;
  /** Dim clock glyph at the head of the well. */
  icon?: boolean;
  id?: string;
  /** Names the group when there is no visible label. */
  'aria-label'?: string;
  /** Content after the segments, inside the well. */
  suffix?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

function partsFromValue(value: TimeValue | null, hourCycle: 12 | 24): SegmentParts {
  if (!value) {
    return hourCycle === 24
      ? { hour: null, minute: null }
      : { hour: null, minute: null, dayPeriod: null };
  }
  if (hourCycle === 24) return { hour: value.hour, minute: value.minute };
  return {
    hour: value.hour % 12 === 0 ? 12 : value.hour % 12,
    minute: value.minute,
    dayPeriod: value.hour >= 12 ? 1 : 0,
  };
}

function composeTime(parts: SegmentParts, hourCycle: 12 | 24): TimeValue | null {
  const minute = parts.minute;
  if (minute == null || minute < 0 || minute > 59) return null;
  if (hourCycle === 24) {
    const hour = parts.hour;
    if (hour == null || hour < 0 || hour > 23) return null;
    return { hour, minute };
  }
  const hour = parts.hour;
  const period = parts.dayPeriod;
  if (hour == null || hour < 1 || hour > 12 || period == null) return null;
  return { hour: (hour % 12) + period * 12, minute };
}

function sameTime(a: TimeValue | null, b: TimeValue | null): boolean {
  if (!a || !b) return a === b;
  return a.hour === b.hour && a.minute === b.minute;
}

export function TimeField({
  label,
  description,
  errorMessage,
  invalid,
  required,
  disabled,
  value: valueProp,
  defaultValue,
  onValueChange,
  hourCycle = 12,
  icon = false,
  id,
  'aria-label': ariaLabel,
  suffix,
  className,
  style,
}: TimeFieldProps): JSX.Element {
  const ids = useFieldIds({ id, description, errorMessage, invalid });
  const [value, setValue] = useControllableState<TimeValue | null>(
    valueProp,
    defaultValue ?? null,
    onValueChange,
  );
  const [parts, setParts] = useState<SegmentParts>(() => partsFromValue(value, hourCycle));
  const partsRef = useRef(parts);
  partsRef.current = parts;

  // An outside edit — a scheduler, a controlling form — refiles the dials.
  useEffect(() => {
    if (!sameTime(value, composeTime(partsRef.current, hourCycle))) {
      setParts(partsFromValue(value, hourCycle));
    }
  }, [value, hourCycle]);

  const items = useMemo<SegmentItem[]>(() => {
    const now = new Date();
    if (hourCycle === 24) {
      return [
        {
          key: 'hour',
          kind: 'number',
          label: 'Hour',
          placeholder: 'HH',
          min: 0,
          max: 23,
          digits: 2,
          seed: now.getHours(),
        },
        { kind: 'literal', text: ':' },
        {
          key: 'minute',
          kind: 'number',
          label: 'Minute',
          placeholder: 'MM',
          min: 0,
          max: 59,
          digits: 2,
          seed: now.getMinutes(),
        },
      ];
    }
    const hour12 = now.getHours() % 12 === 0 ? 12 : now.getHours() % 12;
    return [
      {
        key: 'hour',
        kind: 'number',
        label: 'Hour',
        placeholder: 'HH',
        min: 1,
        max: 12,
        digits: 2,
        seed: hour12,
      },
      { kind: 'literal', text: ':' },
      {
        key: 'minute',
        kind: 'number',
        label: 'Minute',
        placeholder: 'MM',
        min: 0,
        max: 59,
        digits: 2,
        seed: now.getMinutes(),
      },
      { kind: 'literal', text: ' ' },
      {
        key: 'dayPeriod',
        kind: 'period',
        label: 'AM/PM',
        placeholder: '--',
        min: 0,
        max: 1,
        digits: 2,
        seed: now.getHours() >= 12 ? 1 : 0,
      },
    ];
  }, [hourCycle]);

  const handlePartsChange = (next: SegmentParts): void => {
    setParts(next);
    const composed = composeTime(next, hourCycle);
    if (!sameTime(composed, value)) setValue(composed);
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
      <SegmentedField
        items={items}
        parts={parts}
        onPartsChange={handlePartsChange}
        disabled={disabled}
        invalid={ids.invalid}
        required={required}
        id={ids.controlId}
        labelledBy={hasLabel ? ids.labelId : undefined}
        aria-label={hasLabel ? undefined : (ariaLabel ?? 'Time')}
        describedBy={ids.describedBy}
        prefix={icon ? <PixelIcon name="clock" size={16} className="sc-timefield__icon" /> : undefined}
        suffix={suffix}
      />
    </FieldShell>
  );
}
