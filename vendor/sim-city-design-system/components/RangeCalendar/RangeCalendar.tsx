/*
 * Two clicks fence a span of days: the first plants a stake, the second closes
 * the fence — swapped if the clerk walked backwards — and everything between
 * gets the dithered accent wash. While the stake is open, hovering or arrowing
 * previews the fence in pinstripe; Escape pulls the stake without disturbing
 * whatever popover holds the grid.
 */

import { useState } from 'react';
import type { JSX, KeyboardEvent } from 'react';
import {
  CalendarBase,
  compareCalendarDates,
  sameCalendarDate,
  type CalendarBaseProps,
  type CalendarDate,
  type CalendarDayState,
} from '../Calendar';
import { cx } from '../../lib/cx';
import { useControllableState } from '../../lib/useControllableState';
import './RangeCalendar.css';

export interface CalendarDateRange {
  start: CalendarDate;
  end: CalendarDate;
}

export interface RangeCalendarProps
  extends Omit<
    CalendarBaseProps,
    'syncDate' | 'getDayState' | 'onSelect' | 'onFocusedChange' | 'onHoverChange'
  > {
  value?: CalendarDateRange | null;
  defaultValue?: CalendarDateRange | null;
  /** Fires only when a range is complete — never mid-stake. */
  onValueChange?: (range: CalendarDateRange) => void;
}

export function RangeCalendar({
  value: valueProp,
  defaultValue,
  onValueChange,
  className,
  style,
  ...rest
}: RangeCalendarProps): JSX.Element {
  const [value, setValue] = useControllableState<CalendarDateRange | null>(
    valueProp,
    defaultValue ?? null,
    (next) => {
      if (next) onValueChange?.(next);
    },
  );
  /** The first click of a pair; while set, the committed range stands aside. */
  const [anchor, setAnchor] = useState<CalendarDate | null>(null);
  const [hovered, setHovered] = useState<CalendarDate | null>(null);
  /** The roving cell, so keyboard travel previews exactly like the pointer. */
  const [cursor, setCursor] = useState<CalendarDate | null>(null);

  const handleSelect = (date: CalendarDate): void => {
    if (!anchor) {
      setAnchor(date);
      setHovered(null);
      return;
    }
    const reversed = compareCalendarDates(anchor, date) > 0;
    setValue(reversed ? { start: date, end: anchor } : { start: anchor, end: date });
    setAnchor(null);
    setHovered(null);
  };

  const getDayState = (date: CalendarDate): CalendarDayState => {
    if (anchor) {
      const target = hovered ?? cursor ?? anchor;
      const reversed = compareCalendarDates(anchor, target) > 0;
      const start = reversed ? target : anchor;
      const end = reversed ? anchor : target;
      if (sameCalendarDate(date, anchor) || sameCalendarDate(date, target)) {
        return { selected: true };
      }
      if (compareCalendarDates(date, start) > 0 && compareCalendarDates(date, end) < 0) {
        return { preview: true };
      }
      return {};
    }
    if (value) {
      if (sameCalendarDate(date, value.start) || sameCalendarDate(date, value.end)) {
        return { selected: true };
      }
      if (
        compareCalendarDates(date, value.start) > 0 &&
        compareCalendarDates(date, value.end) < 0
      ) {
        return { inRange: true };
      }
    }
    return {};
  };

  // First Escape pulls the open stake; only a second one reaches the popover.
  const cancelAnchor = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Escape' && anchor) {
      event.stopPropagation();
      setAnchor(null);
      setHovered(null);
    }
  };

  return (
    <div className={cx('sc-rangecalendar', className)} style={style} onKeyDown={cancelAnchor}>
      <CalendarBase
        {...rest}
        syncDate={value?.start ?? null}
        getDayState={getDayState}
        onSelect={handleSelect}
        onFocusedChange={setCursor}
        onHoverChange={anchor ? setHovered : undefined}
      />
    </div>
  );
}
