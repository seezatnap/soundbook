/*
 * MM / DD / YYYY in the sunken well — order and separators taken from
 * Intl.DateTimeFormat.formatToParts, so a locale that files the day first
 * gets its way without a date library. The value crossing the API is a plain
 * CalendarDate or null; a half-filled form is null, exactly like a
 * half-filled paper one.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, JSX, ReactNode } from 'react';
import { FieldShell, useFieldIds, type FieldBaseProps } from '../TextField';
import {
  daysInMonth,
  sameCalendarDate,
  todayCalendarDate,
  type CalendarDate,
} from '../Calendar';
import { useControllableState } from '../../lib/useControllableState';
import { SegmentedField, type SegmentItem, type SegmentParts } from './segments';
import './DateField.css';

export interface DateFieldProps extends FieldBaseProps {
  value?: CalendarDate | null;
  defaultValue?: CalendarDate | null;
  /** Fires with the complete date, or null while the form has blanks. */
  onValueChange?: (value: CalendarDate | null) => void;
  /** BCP 47 tag deciding segment order and separators. Default en-US. */
  locale?: string;
  id?: string;
  /** Names the group when there is no visible label. */
  'aria-label'?: string;
  /** Content after the segments, inside the well — DatePicker's button. */
  suffix?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

function partsFromValue(value: CalendarDate | null): SegmentParts {
  return value
    ? { year: value.year, month: value.month, day: value.day }
    : { year: null, month: null, day: null };
}

function composeDate(parts: SegmentParts): CalendarDate | null {
  const { year, month, day } = parts;
  if (year == null || month == null || day == null) return null;
  if (year < 1 || month < 1 || month > 12 || day < 1) return null;
  return { year, month, day: Math.min(day, daysInMonth(year, month)) };
}

function sameValue(a: CalendarDate | null, b: CalendarDate | null): boolean {
  return a === b || sameCalendarDate(a, b);
}

/** 31 until the month is known; February shortens the dial, not the typist. */
function dayMaxFor(parts: SegmentParts): number {
  return parts.month == null ? 31 : daysInMonth(parts.year ?? 2000, parts.month);
}

export function DateField({
  label,
  description,
  errorMessage,
  invalid,
  required,
  disabled,
  value: valueProp,
  defaultValue,
  onValueChange,
  locale = 'en-US',
  id,
  'aria-label': ariaLabel,
  suffix,
  className,
  style,
}: DateFieldProps): JSX.Element {
  const ids = useFieldIds({ id, description, errorMessage, invalid });
  const [value, setValue] = useControllableState<CalendarDate | null>(
    valueProp,
    defaultValue ?? null,
    onValueChange,
  );
  const [parts, setParts] = useState<SegmentParts>(() => partsFromValue(value));
  const partsRef = useRef(parts);
  partsRef.current = parts;

  // An outside edit — a picker, a controlling form — refiles the segments.
  useEffect(() => {
    if (!sameValue(value, composeDate(partsRef.current))) setParts(partsFromValue(value));
  }, [value]);

  const dayMax = dayMaxFor(parts);

  const items = useMemo<SegmentItem[]>(() => {
    const today = todayCalendarDate();
    const order = new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date(1993, 8, 12));
    const out: SegmentItem[] = [];
    for (const part of order) {
      if (part.type === 'month') {
        out.push({
          key: 'month',
          kind: 'number',
          label: 'Month',
          placeholder: 'MM',
          min: 1,
          max: 12,
          digits: 2,
          seed: today.month,
        });
      } else if (part.type === 'day') {
        out.push({
          key: 'day',
          kind: 'number',
          label: 'Day',
          placeholder: 'DD',
          min: 1,
          max: dayMax,
          digits: 2,
          seed: Math.min(today.day, dayMax),
        });
      } else if (part.type === 'year') {
        out.push({
          key: 'year',
          kind: 'number',
          label: 'Year',
          placeholder: 'YYYY',
          min: 1,
          max: 9999,
          digits: 4,
          seed: today.year,
        });
      } else if (part.type === 'literal') {
        out.push({ kind: 'literal', text: part.value });
      }
    }
    return out;
  }, [locale, dayMax]);

  const handlePartsChange = (next: SegmentParts): void => {
    const nextDayMax = dayMaxFor(next);
    const clamped =
      next.day != null && next.day > nextDayMax ? { ...next, day: nextDayMax } : next;
    setParts(clamped);
    const composed = composeDate(clamped);
    if (!sameValue(composed, value)) setValue(composed);
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
        aria-label={hasLabel ? undefined : (ariaLabel ?? 'Date')}
        describedBy={ids.describedBy}
        suffix={suffix}
      />
    </FieldShell>
  );
}
