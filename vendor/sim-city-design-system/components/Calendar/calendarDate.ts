/*
 * The date the public API speaks: a plain {year, month, day} with month 1-12,
 * exactly as printed on the form. No Date object crosses a component boundary,
 * so no timezone can move a hearing to the previous evening. Date is used
 * internally for weekday math only, always in local time.
 */

export interface CalendarDate {
  year: number;
  /** 1-12, as a clerk would write it. */
  month: number;
  day: number;
}

/** Local-midnight Date for a calendar date. Correct even below year 100. */
export function calendarDateToDate(value: CalendarDate): Date {
  const date = new Date(value.year, value.month - 1, value.day);
  date.setFullYear(value.year);
  return date;
}

export function calendarDateFromDate(date: Date): CalendarDate {
  return { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() };
}

export function todayCalendarDate(): CalendarDate {
  return calendarDateFromDate(new Date());
}

const MONTH_LENGTHS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    return leap ? 29 : 28;
  }
  return MONTH_LENGTHS[month - 1];
}

export function sameCalendarDate(
  a: CalendarDate | null | undefined,
  b: CalendarDate | null | undefined,
): boolean {
  if (!a || !b) return false;
  return a.year === b.year && a.month === b.month && a.day === b.day;
}

/** Negative when `a` is earlier, zero when equal, positive when later. */
export function compareCalendarDates(a: CalendarDate, b: CalendarDate): number {
  return a.year - b.year || a.month - b.month || a.day - b.day;
}

export function addCalendarDays(value: CalendarDate, days: number): CalendarDate {
  const date = calendarDateToDate(value);
  date.setDate(date.getDate() + days);
  return calendarDateFromDate(date);
}

/** Month arithmetic clamps the day, so Jan 31 + 1 month is Feb 28, not Mar 3. */
export function addCalendarMonths(value: CalendarDate, months: number): CalendarDate {
  const total = value.year * 12 + (value.month - 1) + months;
  const year = Math.floor(total / 12);
  const month = ((total % 12) + 12) % 12 + 1;
  return { year, month, day: Math.min(value.day, daysInMonth(year, month)) };
}

export function clampCalendarDate(
  value: CalendarDate,
  min?: CalendarDate,
  max?: CalendarDate,
): CalendarDate {
  if (min && compareCalendarDates(value, min) < 0) return min;
  if (max && compareCalendarDates(value, max) > 0) return max;
  return value;
}
