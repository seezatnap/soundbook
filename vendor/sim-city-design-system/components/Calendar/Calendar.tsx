/*
 * A month of hearings on one grid. The table is real — role="grid" over real
 * <th>/<td> — because the APG date-grid pattern is a table, and the 1993 look
 * is only 24px plates painted onto it.
 *
 * CalendarBase owns the view (visible month, roving tabindex, keyboard
 * contract, live announcement) and asks its wrapper what each day means.
 * Calendar is the single-date wrapper; RangeCalendar (its own folder) reuses
 * the base to fence spans.
 */

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { CSSProperties, JSX, KeyboardEvent } from 'react';
import { Button } from '../Button';
import { IconButton } from '../IconButton';
import { cx } from '../../lib/cx';
import { useControllableState } from '../../lib/useControllableState';
import {
  addCalendarDays,
  addCalendarMonths,
  calendarDateToDate,
  clampCalendarDate,
  compareCalendarDates,
  daysInMonth,
  sameCalendarDate,
  todayCalendarDate,
  type CalendarDate,
} from './calendarDate';
import './Calendar.css';

/** How a wrapper paints one day. Ranges add the dithered interior states. */
export interface CalendarDayState {
  /** Full accent plate; also reported as aria-selected. */
  selected?: boolean;
  /** Interior of a committed range: hard 1px accent checker. */
  inRange?: boolean;
  /** Interior of a range still being dragged: accent pinstripe. */
  preview?: boolean;
}

export interface CalendarBaseProps {
  /** Follows the wrapper's committed value, so outside edits page the view. */
  syncDate?: CalendarDate | null;
  min?: CalendarDate;
  max?: CalendarDate;
  /** Extra fencing on top of min/max — weekends, holidays, dark days. */
  isDateDisabled?: (date: CalendarDate) => boolean;
  weekStartsOn?: 0 | 1;
  /** BCP 47 tag for month and weekday names. Municipal default: en-US. */
  locale?: string;
  /** Move DOM focus onto the grid at mount — pickers opening a popover want it. */
  autoFocus?: boolean;
  getDayState?: (date: CalendarDate) => CalendarDayState;
  onSelect?: (date: CalendarDate) => void;
  /** Fires whenever the roving cell moves; range preview follows it. */
  onFocusedChange?: (date: CalendarDate) => void;
  /** Fires per-cell on hover, null on leaving the grid. Wired only if given. */
  onHoverChange?: (date: CalendarDate | null) => void;
  className?: string;
  style?: CSSProperties;
}

function dateKey(date: CalendarDate): string {
  return `${date.year}-${date.month}-${date.day}`;
}

export function CalendarBase({
  syncDate,
  min,
  max,
  isDateDisabled,
  weekStartsOn = 0,
  locale = 'en-US',
  autoFocus,
  getDayState,
  onSelect,
  onFocusedChange,
  onHoverChange,
  className,
  style,
}: CalendarBaseProps): JSX.Element {
  const headingId = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const pendingFocus = useRef(false);
  const today = todayCalendarDate();

  const [focused, setFocused] = useState<CalendarDate>(() =>
    clampCalendarDate(syncDate ?? todayCalendarDate(), min, max),
  );
  // Invariant: `focused` always lives inside the visible month, so the grid
  // always contains exactly one tab stop.
  const [visible, setVisible] = useState(() => ({ year: focused.year, month: focused.month }));

  const focusTo = (next: CalendarDate, focusDom: boolean): void => {
    const clamped = clampCalendarDate(next, min, max);
    setFocused(clamped);
    setVisible({ year: clamped.year, month: clamped.month });
    if (focusDom) pendingFocus.current = true;
    onFocusedChange?.(clamped);
  };

  // An outside edit (typed segments, a controlling form) refiles the view.
  const lastSync = useRef<CalendarDate | null | undefined>(syncDate);
  useEffect(() => {
    const previous = lastSync.current;
    lastSync.current = syncDate;
    if (!syncDate || sameCalendarDate(previous, syncDate)) return;
    if (sameCalendarDate(syncDate, focused)) return;
    focusTo(syncDate, false);
    // The refs and setters are stable; only the incoming date matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncDate]);

  useEffect(() => {
    if (!autoFocus) return;
    rootRef.current?.querySelector<HTMLElement>('td[tabindex="0"]')?.focus();
    // Mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keyboard moves land after render, when the target cell exists.
  useEffect(() => {
    if (!pendingFocus.current) return;
    pendingFocus.current = false;
    rootRef.current?.querySelector<HTMLElement>(`[data-date="${dateKey(focused)}"]`)?.focus();
  }, [focused]);

  const monthFormat = useMemo(() => new Intl.DateTimeFormat(locale, { month: 'long' }), [locale]);
  const cellFormat = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
    [locale],
  );

  const weekdays = useMemo(() => {
    const long = new Intl.DateTimeFormat(locale, { weekday: 'long' });
    const short = new Intl.DateTimeFormat(locale, { weekday: 'short' });
    // 2023-01-01 was a Sunday.
    return Array.from({ length: 7 }, (_, i) => {
      const probe = new Date(2023, 0, 1 + ((i + weekStartsOn) % 7));
      return { long: long.format(probe), short: short.format(probe).slice(0, 2).toUpperCase() };
    });
  }, [locale, weekStartsOn]);

  // Always six rows: a month never changes the height of its panel.
  const cells = useMemo(() => {
    const first: CalendarDate = { year: visible.year, month: visible.month, day: 1 };
    const lead = (calendarDateToDate(first).getDay() - weekStartsOn + 7) % 7;
    const start = addCalendarDays(first, -lead);
    return Array.from({ length: 42 }, (_, i) => addCalendarDays(start, i));
  }, [visible.year, visible.month, weekStartsOn]);

  const isDisabledDay = (date: CalendarDate): boolean =>
    (min !== undefined && compareCalendarDates(date, min) < 0) ||
    (max !== undefined && compareCalendarDates(date, max) > 0) ||
    (isDateDisabled?.(date) ?? false);

  const select = (date: CalendarDate): void => {
    if (isDisabledDay(date)) return;
    focusTo(date, true);
    onSelect?.(date);
  };

  const page = (months: number, focusDom: boolean): void => {
    focusTo(addCalendarMonths(focused, months), focusDom);
  };

  const handleCellKeyDown =
    (date: CalendarDate) =>
    (event: KeyboardEvent<HTMLTableCellElement>): void => {
      const key = event.key;
      let handled = true;
      if (key === 'ArrowLeft') focusTo(addCalendarDays(date, -1), true);
      else if (key === 'ArrowRight') focusTo(addCalendarDays(date, 1), true);
      else if (key === 'ArrowUp') focusTo(addCalendarDays(date, -7), true);
      else if (key === 'ArrowDown') focusTo(addCalendarDays(date, 7), true);
      else if (key === 'PageUp') page(event.shiftKey ? -12 : -1, true);
      else if (key === 'PageDown') page(event.shiftKey ? 12 : 1, true);
      else if (key === 'Home' || key === 'End') {
        const lead = (calendarDateToDate(date).getDay() - weekStartsOn + 7) % 7;
        focusTo(addCalendarDays(date, key === 'Home' ? -lead : 6 - lead), true);
      } else if (key === 'Enter' || key === ' ') select(date);
      else handled = false;
      if (handled) event.preventDefault();
    };

  const firstOfVisible: CalendarDate = { year: visible.year, month: visible.month, day: 1 };
  const prevMonthEnd = addCalendarDays(firstOfVisible, -1);
  const nextMonthStart = addCalendarDays(
    { ...firstOfVisible, day: daysInMonth(visible.year, visible.month) },
    1,
  );
  const prevDisabled = min !== undefined && compareCalendarDates(prevMonthEnd, min) < 0;
  const nextDisabled = max !== undefined && compareCalendarDates(nextMonthStart, max) > 0;
  const todayOutOfRange =
    (min !== undefined && compareCalendarDates(today, min) < 0) ||
    (max !== undefined && compareCalendarDates(today, max) > 0);

  const headingText = `${monthFormat.format(
    calendarDateToDate(firstOfVisible),
  )} ${visible.year}`;

  return (
    <div ref={rootRef} className={cx('sc-calendar', className)} style={style}>
      <div className="sc-calendar__header">
        <IconButton
          size="sm"
          icon="chevron-left"
          label="Previous month"
          disabled={prevDisabled}
          onClick={() => page(-1, false)}
        />
        {/* The heading is the polite live region: paging announces the month. */}
        <span className="sc-calendar__heading" id={headingId} aria-live="polite" aria-atomic="true">
          {headingText}
        </span>
        <IconButton
          size="sm"
          icon="chevron-right"
          label="Next month"
          disabled={nextDisabled}
          onClick={() => page(1, false)}
        />
        <Button
          size="sm"
          className="sc-calendar__today-button"
          disabled={todayOutOfRange}
          onClick={() => focusTo(today, false)}
        >
          TODAY
        </Button>
      </div>
      <table
        role="grid"
        aria-labelledby={headingId}
        className="sc-calendar__grid"
        onMouseLeave={onHoverChange ? () => onHoverChange(null) : undefined}
      >
        <thead>
          <tr>
            {weekdays.map((weekday) => (
              <th
                key={weekday.long}
                scope="col"
                aria-label={weekday.long}
                className="sc-calendar__weekday"
              >
                {weekday.short}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 6 }, (_, row) => (
            <tr key={row}>
              {cells.slice(row * 7, row * 7 + 7).map((date) => {
                const otherMonth = date.month !== visible.month || date.year !== visible.year;
                const disabled = isDisabledDay(date);
                const state = getDayState?.(date) ?? {};
                return (
                  <td
                    key={dateKey(date)}
                    data-date={dateKey(date)}
                    tabIndex={sameCalendarDate(date, focused) ? 0 : -1}
                    aria-selected={state.selected || state.inRange || undefined}
                    aria-disabled={disabled || undefined}
                    aria-label={cellFormat.format(calendarDateToDate(date))}
                    className={cx(
                      'sc-calendar__day',
                      otherMonth && 'sc-calendar__day--other',
                      sameCalendarDate(date, today) && 'sc-calendar__day--today',
                      state.inRange && 'sc-calendar__day--in-range',
                      state.preview && 'sc-calendar__day--preview',
                      state.selected && 'sc-calendar__day--selected',
                      disabled && 'sc-calendar__day--disabled',
                    )}
                    onClick={() => select(date)}
                    onKeyDown={handleCellKeyDown(date)}
                    onMouseEnter={onHoverChange ? () => onHoverChange(date) : undefined}
                  >
                    {date.day}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export interface CalendarProps
  extends Omit<
    CalendarBaseProps,
    'syncDate' | 'getDayState' | 'onSelect' | 'onFocusedChange' | 'onHoverChange'
  > {
  value?: CalendarDate | null;
  defaultValue?: CalendarDate | null;
  onValueChange?: (value: CalendarDate) => void;
}

export function Calendar({
  value: valueProp,
  defaultValue,
  onValueChange,
  ...rest
}: CalendarProps): JSX.Element {
  const [value, setValue] = useControllableState<CalendarDate | null>(
    valueProp,
    defaultValue ?? null,
    (next) => {
      if (next) onValueChange?.(next);
    },
  );

  return (
    <CalendarBase
      {...rest}
      syncDate={value}
      getDayState={(date) => ({ selected: sameCalendarDate(date, value) })}
      onSelect={setValue}
    />
  );
}
