import { describe, expect, it } from 'vitest';
import { calendarDateToLocalDate, calendarDaysBetween, isMeasurementDue, toCalendarDate, todayAsCalendarDate } from './calendar-date';

describe('todayAsCalendarDate', () => {
  it('formats a date as a calendar day', () => {
    expect(todayAsCalendarDate(new Date(2026, 8, 18, 23, 30))).toBe('2026-09-18');
  });

  // A UTC-based conversion would call this 2026-09-19 for a viewer behind UTC, and vice versa.
  it('uses the local calendar rather than UTC', () => {
    expect(todayAsCalendarDate(new Date(2026, 8, 18, 0, 30))).toBe('2026-09-18');
  });
});

describe('calendarDaysBetween', () => {
  it('counts whole days', () => {
    expect(calendarDaysBetween('2026-09-19', '2026-09-26')).toBe(7);
  });

  it('is negative when the second day precedes the first', () => {
    expect(calendarDaysBetween('2026-09-26', '2026-09-19')).toBe(-7);
  });
});

describe('isMeasurementDue', () => {
  it('is never due when the user has not opted in', () => {
    expect(isMeasurementDue('2020-01-01', null, '2026-09-18')).toBe(false);
  });

  it('is due immediately once opted in with nothing logged', () => {
    expect(isMeasurementDue(null, 7, '2026-09-18')).toBe(true);
  });

  // The rule this exists for: measuring Saturday at 11:00 must not block the next Saturday at
  // 09:00. Neither value carries a time, so seven whole days have passed and it is due.
  it('is due exactly a week later, whatever the clock said', () => {
    expect(isMeasurementDue('2026-09-19', 7, '2026-09-26')).toBe(true);
  });

  it('is not due a day early', () => {
    expect(isMeasurementDue('2026-09-19', 7, '2026-09-25')).toBe(false);
  });

  it('stays due once overdue', () => {
    expect(isMeasurementDue('2026-09-19', 7, '2026-10-05')).toBe(true);
  });

  it('honours a longer cadence', () => {
    expect(isMeasurementDue('2026-09-01', 28, '2026-09-28')).toBe(false);
    expect(isMeasurementDue('2026-09-01', 28, '2026-09-29')).toBe(true);
  });
});

/**
 * The trap this replaced: `new Date('2026-09-01Z')` is UTC midnight, which is 31 August for every
 * viewer west of Greenwich - a whole charted series drawn a day early.
 */
describe('calendarDateToLocalDate', () => {
  it('should land on the named day in the local calendar', () => {
    const date = calendarDateToLocalDate('2026-09-01');

    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(8);
    expect(date.getDate()).toBe(1);
  });

  it('should put it at local midnight, so a day is a clean tick on a time axis', () => {
    const date = calendarDateToLocalDate('2026-09-01');

    expect([date.getHours(), date.getMinutes(), date.getSeconds()]).toEqual([0, 0, 0]);
  });

  it('should round-trip through the formatter it pairs with', () => {
    expect(toCalendarDate(calendarDateToLocalDate('2026-12-31'))).toBe('2026-12-31');
  });
});
