import { describe, expect, it } from 'vitest';
import { DateRangePreset, presetToRange } from './date-range-presets';

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
