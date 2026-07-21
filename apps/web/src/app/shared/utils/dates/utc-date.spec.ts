import { describe, it, expect } from 'vitest';
import { toUtcDate } from './utc-date';

describe('toUtcDate', () => {
  it.each([null, undefined, ''])('returns null for an absent value (%p)', (value) => {
    expect(toUtcDate(value)).toBeNull();
  });

  it('treats a naive timestamp (no offset) as UTC', () => {
    // The API serialises `timestamp without time zone` without a `Z`; parsing it with the browser's
    // local timezone instead of UTC would drift the instant by the local offset.
    expect(toUtcDate('2026-07-20T10:00:00')!.toISOString()).toBe('2026-07-20T10:00:00.000Z');
  });

  it('preserves fractional seconds on a naive timestamp', () => {
    expect(toUtcDate('2026-07-20T10:00:00.500')!.toISOString()).toBe('2026-07-20T10:00:00.500Z');
  });

  it('passes through a value that already ends with Z', () => {
    expect(toUtcDate('2026-07-20T10:00:00.000Z')!.toISOString()).toBe('2026-07-20T10:00:00.000Z');
  });

  it('passes through an explicit numeric offset', () => {
    // 12:00+02:00 is 10:00 UTC - the offset must be honoured, not overwritten with Z.
    expect(toUtcDate('2026-07-20T12:00:00+02:00')!.toISOString()).toBe('2026-07-20T10:00:00.000Z');
  });
});
