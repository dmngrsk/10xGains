import { describe, expect, it } from 'vitest';
import { estimateJacksonPollockBodyFat } from './jackson-pollock';

/**
 * Reference values.
 *
 * The *coefficients* are what was verified against published sources; these expected percentages
 * are then computed from them. They exist to pin the coefficient sets and the variant routing, so
 * a wrong digit or a swapped male/female set fails here rather than shipping.
 */
describe('estimateJacksonPollockBodyFat', () => {
  describe('JP3', () => {
    // chest 12 + abdomen 20 + thigh 15 = 47 mm, age 32
    it('reproduces the male reference value', () => {
      expect(estimateJacksonPollockBodyFat('JP3', 'MALE', [12, 20, 15], 32)).toBe(14.4);
    });

    // triceps 18 + suprailiac 14 + thigh 26 = 58 mm, age 30
    it('reproduces the female reference value', () => {
      expect(estimateJacksonPollockBodyFat('JP3', 'FEMALE', [18, 14, 26], 30)).toBe(23.5);
    });
  });

  describe('JP7', () => {
    // 12 + 9 + 11 + 13 + 20 + 14 + 15 = 94 mm, age 32
    it('reproduces the male reference value', () => {
      expect(estimateJacksonPollockBodyFat('JP7', 'MALE', [12, 9, 11, 13, 20, 14, 15], 32)).toBe(14);
    });

    // 14 + 12 + 18 + 13 + 19 + 14 + 26 = 116 mm, age 30
    it('reproduces the female reference value', () => {
      expect(estimateJacksonPollockBodyFat('JP7', 'FEMALE', [14, 12, 18, 13, 19, 14, 26], 30)).toBe(23.1);
    });
  });

  describe('the coefficient sets are distinct', () => {
    it('does not give the two variants the same answer for the same calipers', () => {
      const sites = [12, 20, 15];

      expect(estimateJacksonPollockBodyFat('JP3', 'MALE', sites, 30))
        .not.toBe(estimateJacksonPollockBodyFat('JP3', 'FEMALE', sites, 30));
    });

    it('does not give the two methods the same answer for the same sum', () => {
      expect(estimateJacksonPollockBodyFat('JP3', 'MALE', [47], 30))
        .not.toBe(estimateJacksonPollockBodyFat('JP7', 'MALE', [47], 30));
    });
  });

  describe('age', () => {
    // Age is a term in every variant, so it must actually move the result.
    it('raises the estimate for an older body at the same skinfolds', () => {
      const young = estimateJacksonPollockBodyFat('JP3', 'MALE', [12, 20, 15], 20)!;
      const older = estimateJacksonPollockBodyFat('JP3', 'MALE', [12, 20, 15], 50)!;

      expect(older).toBeGreaterThan(young);
    });

    it.each([
      ['a child, outside the fitted range', 12],
      ['an implausible age', 130],
      ['a non-finite age', Number.NaN],
    ])('returns null for %s', (_label, age) => {
      expect(estimateJacksonPollockBodyFat('JP3', 'MALE', [12, 20, 15], age)).toBeNull();
    });
  });

  describe('inputs that cannot yield an answer', () => {
    it('returns null when a site is missing', () => {
      expect(estimateJacksonPollockBodyFat('JP3', 'MALE', [], 30)).toBeNull();
    });

    it.each([
      ['a zero reading', [12, 0, 15]],
      ['a negative reading', [12, -20, 15]],
    ])('returns null for %s', (_label, sites) => {
      expect(estimateJacksonPollockBodyFat('JP3', 'MALE', sites, 30)).toBeNull();
    });

    // A sum far outside what the equations were fitted on drives the density term out of range.
    it('returns null rather than an implausible percentage', () => {
      expect(estimateJacksonPollockBodyFat('JP7', 'MALE', [400, 400, 400, 400, 400, 400, 400], 30))
        .toBeNull();
    });
  });
});
