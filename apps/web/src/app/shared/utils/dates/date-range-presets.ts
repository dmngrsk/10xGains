import { format, subMonths } from 'date-fns';

/**
 * The preset ranges offered by the shared date range field. Each preset sets a start date and
 * leaves the end open; `ALL` clears both bounds.
 */
export type DateRangePreset = '1M' | '3M' | '6M' | '1Y' | 'ALL';

/**
 * The canonical filter state of a date range. Concrete dates drive the query; the preset is a
 * convenience setter, remembered only for display (chip highlight on reopen, summary text).
 */
export interface DateRangeValue {
  preset: DateRangePreset | null; // null = custom range
  dateFrom: string | null;        // ISO, inclusive
  dateTo: string | null;          // ISO, inclusive (mapped to end of day)
}

export const DATE_RANGE_PRESET_ORDER: DateRangePreset[] = ['1M', '3M', '6M', '1Y', 'ALL'];

export const DATE_RANGE_PRESET_LABELS: Record<DateRangePreset, string> = {
  '1M': 'Last month',
  '3M': 'Last 3 months',
  '6M': 'Last 6 months',
  '1Y': 'Last year',
  'ALL': 'All time',
};

/**
 * Resolves a preset to concrete bounds relative to `now`. A preset sets the inclusive lower
 * bound and leaves the upper bound open; `ALL` leaves both open.
 *
 * @param preset The preset to resolve.
 * @param now The reference point the range is measured back from.
 * @returns The `dateFrom`/`dateTo` bounds, as ISO strings or null when open.
 */
export function presetToRange(preset: DateRangePreset, now: Date): { dateFrom: string | null; dateTo: string | null } {
  switch (preset) {
    case '1M':
      return { dateFrom: subMonths(now, 1).toISOString(), dateTo: null };
    case '3M':
      return { dateFrom: subMonths(now, 3).toISOString(), dateTo: null };
    case '6M':
      return { dateFrom: subMonths(now, 6).toISOString(), dateTo: null };
    case '1Y':
      return { dateFrom: subMonths(now, 12).toISOString(), dateTo: null };
    case 'ALL':
      return { dateFrom: null, dateTo: null };
  }
}

/**
 * Formats a date range for a filter summary. A preset shows its full label; a custom range
 * shows the dates ("Mar 12, 2026 – Jul 15, 2026"), collapsing to "Since …" / "Until …" when
 * one bound is open, and to the "All time" label when both are.
 *
 * @param value The date range to summarize.
 * @returns A human-readable summary of the range.
 */
export function formatDateRangeSummary(value: DateRangeValue): string {
  if (value.preset) {
    return DATE_RANGE_PRESET_LABELS[value.preset];
  }

  const from = value.dateFrom ? format(new Date(value.dateFrom), 'MMM d, yyyy') : null;
  const to = value.dateTo ? format(new Date(value.dateTo), 'MMM d, yyyy') : null;

  if (from && to) {
    return `${from} – ${to}`;
  }
  if (from) {
    return `Since ${from}`;
  }
  if (to) {
    return `Until ${to}`;
  }

  return DATE_RANGE_PRESET_LABELS['ALL'];
}
