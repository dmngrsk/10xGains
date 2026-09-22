import { describe, expect, it } from 'vitest';
import { estimateNavyBodyFat } from './navy';

describe('estimateNavyBodyFat', () => {
  describe('published worked examples', () => {
    // The male case is the worked example the tape-method calculators document:
    // 183 cm tall, 38.6 cm neck, 102.1 cm waist yields 26.8%. It pins the coefficients, which
    // no reviewer can check by eye.
    it('reproduces the documented male example', () => {
      expect(estimateNavyBodyFat('MALE', { heightCm: 183, neckCm: 38.6, waistCm: 102.1 }))
        .toBe(26.8);
    });

    // Derived from the same verified female coefficients. It guards the variant split: running
    // the male equation on these inputs gives a materially different number.
    it('applies the female coefficients and includes the hips', () => {
      expect(estimateNavyBodyFat('FEMALE', { heightCm: 168, neckCm: 32, waistCm: 76, hipsCm: 98 }))
        .toBe(28.6);
    });

    it('does not give the two variants the same answer for the same tape', () => {
      const inputs = { heightCm: 170, neckCm: 36, waistCm: 85, hipsCm: 95 };

      expect(estimateNavyBodyFat('MALE', inputs)).not.toBe(estimateNavyBodyFat('FEMALE', inputs));
    });
  });

  describe('inputs that cannot yield an answer', () => {
    it.each([
      ['a zero height', { heightCm: 0, neckCm: 38, waistCm: 90 }],
      ['a negative waist', { heightCm: 180, neckCm: 38, waistCm: -90 }],
      ['a missing neck', { heightCm: 180, neckCm: 0, waistCm: 90 }],
    ])('returns null for %s', (_label, inputs) => {
      expect(estimateNavyBodyFat('MALE', inputs)).toBeNull();
    });

    // Real data: a waist typed in smaller than the neck leaves the girth term with no logarithm.
    it('returns null when the waist is no wider than the neck', () => {
      expect(estimateNavyBodyFat('MALE', { heightCm: 180, neckCm: 40, waistCm: 40 })).toBeNull();
      expect(estimateNavyBodyFat('MALE', { heightCm: 180, neckCm: 40, waistCm: 38 })).toBeNull();
    });

    it('returns null for the female variant when the hips are absent', () => {
      const inputs = { heightCm: 168, neckCm: 32, waistCm: 76 };

      expect(estimateNavyBodyFat('FEMALE', inputs)).toBeNull();
      expect(estimateNavyBodyFat('FEMALE', { ...inputs, hipsCm: null })).toBeNull();
    });

    // The regression is fitted to a normal range of bodies, so an extreme tape drives it outside
    // anything a person holds. Reporting no answer beats charting a negative percentage.
    it('returns null rather than an implausible percentage', () => {
      const result = estimateNavyBodyFat('MALE', { heightCm: 210, neckCm: 40, waistCm: 41 });

      expect(result).toBeNull();
    });
  });

  it('rounds to one decimal, the precision the readings themselves carry', () => {
    const result = estimateNavyBodyFat('MALE', { heightCm: 183, neckCm: 38.6, waistCm: 102.1 });

    expect(result).toBe(Math.round(result! * 10) / 10);
  });
});
