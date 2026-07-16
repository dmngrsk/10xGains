import { describe, expect, it } from 'vitest';
import { DateRangePreset, formatDateRangeSummary, presetToRange } from './date-range-presets';

const NOW = new Date('2026-07-13T12:00:00.000Z');

describe('presetToRange', () => {
  it.each([
    { preset: '1M', months: 1 },
    { preset: '3M', months: 3 },
    { preset: '6M', months: 6 },
    { preset: '1Y', months: 12 },
  ] as { preset: DateRangePreset; months: number }[])(
    'should subtract the preset length and leave the end open for $preset',
    ({ preset, months }) => {
      const result = presetToRange(preset, NOW);

      const expected = new Date(NOW);
      expected.setMonth(expected.getMonth() - months);

      // Local-time month arithmetic may shift the UTC hour across DST boundaries.
      const dstToleranceMs = 2 * 60 * 60 * 1000;
      expect(Math.abs(new Date(result.dateFrom!).getTime() - expected.getTime())).toBeLessThanOrEqual(dstToleranceMs);
      expect(result.dateTo).toBeNull();
    }
  );

  it('should leave both bounds open for ALL', () => {
    expect(presetToRange('ALL', NOW)).toEqual({ dateFrom: null, dateTo: null });
  });
});

describe('formatDateRangeSummary', () => {
  it('should show the full preset label when a preset is active', () => {
    expect(formatDateRangeSummary({ preset: '3M', dateFrom: '2026-04-13T12:00:00.000Z', dateTo: null })).toBe('Last 3 months');
  });

  it('should show both dates for a bounded custom range', () => {
    expect(formatDateRangeSummary({
      preset: null,
      dateFrom: '2026-03-12T00:00:00.000Z',
      dateTo: '2026-07-15T23:59:59.999Z',
    })).toBe('Mar 12, 2026 – Jul 15, 2026');
  });

  it('should collapse to "Since" when only the start is set', () => {
    expect(formatDateRangeSummary({ preset: null, dateFrom: '2026-03-12T00:00:00.000Z', dateTo: null })).toBe('Since Mar 12, 2026');
  });

  it('should collapse to "Until" when only the end is set', () => {
    expect(formatDateRangeSummary({ preset: null, dateFrom: null, dateTo: '2026-07-15T23:59:59.999Z' })).toBe('Until Jul 15, 2026');
  });

  it('should fall back to the All time label when both bounds are open', () => {
    expect(formatDateRangeSummary({ preset: null, dateFrom: null, dateTo: null })).toBe('All time');
  });
});
