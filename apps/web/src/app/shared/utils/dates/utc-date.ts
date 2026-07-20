/**
 * Parses a timestamp string returned by the API into a `Date`, treating a naive timestamp
 * (one with no timezone offset) as UTC.
 *
 * The backend stores its timestamps as `timestamp without time zone`, and PostgREST serialises them
 * without a trailing `Z` or offset. `new Date('2026-07-20T10:00:00')` would parse that in the
 * browser's *local* timezone, drifting the instant by the local offset; appending `Z` first pins it
 * to UTC, which is what the column actually holds. A value that already carries `Z` or an explicit
 * `±hh:mm` offset is passed through untouched.
 *
 * Returns `null` for an absent value (null / undefined / empty string) rather than substituting
 * "now", so callers can render a placeholder — a PENDING session, for instance, has no date yet.
 *
 * @param dateString The timestamp string from an API DTO, if any.
 * @returns The parsed `Date`, or `null` when there is no timestamp.
 */
export function toUtcDate(dateString: string | null | undefined): Date | null {
  if (!dateString) {
    return null;
  }

  const isoString = dateString.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(dateString)
    ? dateString
    : dateString + 'Z';

  return new Date(isoString);
}
