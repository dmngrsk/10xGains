import { describe, expect, it } from 'vitest';
import { densityToBodyFat } from './siri';

describe('densityToBodyFat', () => {
  it('applies the Siri equation', () => {
    // 495 / 1.05 - 450 = 21.4286
    expect(densityToBodyFat(1.05)).toBe(21.4);
  });

  it('gives a leaner body a lower percentage', () => {
    expect(densityToBodyFat(1.08)!).toBeLessThan(densityToBodyFat(1.03)!);
  });

  it.each([
    ['zero', 0],
    ['a negative density', -1.05],
    ['a non-finite density', Number.NaN],
  ])('returns null for %s', (_label, density) => {
    expect(densityToBodyFat(density)).toBeNull();
  });

  // The equations are fitted to a normal range of bodies; a density far outside it converts to a
  // percentage no human holds. Reporting no answer beats charting one.
  it('returns null rather than an implausible percentage', () => {
    expect(densityToBodyFat(1.4)).toBeNull();
    expect(densityToBodyFat(0.8)).toBeNull();
  });

  it('rounds to one decimal, the precision the readings themselves carry', () => {
    const result = densityToBodyFat(1.05);

    expect(result).toBe(Math.round(result! * 10) / 10);
  });
});
