import { differenceInCalendarDays, format, parseISO } from 'date-fns';

/**
 * A calendar day, as `YYYY-MM-DD`.
 *
 * `measurements.measured_on` is a Postgres `date`: it names a day and carries no time and no zone.
 * Comparing it through `Date`'s UTC conversions is what makes a user in UTC+2 at 01:00 on Saturday
 * be told it is still Friday, so these helpers work in the viewer's own local calendar instead.
 */

/** Today, in the viewer's local calendar. */
export function todayAsCalendarDate(now: Date = new Date()): string {
  return format(now, 'yyyy-MM-dd');
}

/** Formats a `Date` as a calendar day, in local time. */
export function toCalendarDate(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

/**
 * Whole days from one calendar day to another; negative when `to` precedes `from`.
 *
 * Whole days are the point: measuring on Saturday at 11:00 must not block measuring the following
 * Saturday at 09:00, and it cannot, because neither value carries a time to compare.
 */
export function calendarDaysBetween(from: string, to: string): number {
  return differenceInCalendarDays(parseISO(to), parseISO(from));
}

/**
 * Whether a measurement reminder is due.
 *
 * @param lastMeasuredOn The most recent measurement's day, or null when nothing is logged.
 * @param frequencyDays The user's cadence; null means they have not opted in.
 * @param today Today, in the viewer's local calendar.
 * @returns True when the prompt should be shown.
 */
export function isMeasurementDue(
  lastMeasuredOn: string | null,
  frequencyDays: number | null,
  today: string = todayAsCalendarDate()
): boolean {
  if (frequencyDays === null || frequencyDays === undefined) {
    return false;
  }

  // Opted in but never measured: due immediately, which is what gets the first round logged.
  if (!lastMeasuredOn) {
    return true;
  }

  return calendarDaysBetween(lastMeasuredOn, today) >= frequencyDays;
}

/**
 * A calendar day as a local `Date`, for plotting on a time axis.
 *
 * `parseISO` puts a date-only string at local midnight, which is what a `date` column means. The
 * trap it avoids is `new Date('2026-09-01Z')`, which is UTC midnight and lands on 31 August for
 * every viewer west of Greenwich - a whole series drawn a day early.
 */
export function calendarDateToLocalDate(date: string): Date {
  return parseISO(date);
}
