import { describe, expect, it } from 'vitest';
import type { BodyFatMethod, Sex } from '@txg/shared';
import type { MeasurementReading } from './body-composition';
import { BODY_FAT_INPUT_TYPES, bodyFatMethodInputs, estimateBodyFatSeries } from './body-composition';


const HEIGHT = 183;

/** Height is a profile setting now, not a row, so every Navy case carries it here. */
const MALE = { sex: 'MALE' as const, height_cm: HEIGHT };

function reading(measured_on: string, type: MeasurementReading['type'], value: number): MeasurementReading {
  return { measured_on, type, value };
}

/** The documented worked example, spread over whatever dates a test needs. */
const NECK = 38.6;
const WAIST = 102.1;
const EXPECTED = 26.8;

describe('estimateBodyFatSeries', () => {
  it('estimates a date on which every input was measured', () => {
    const rows = [
      reading('2026-09-01', 'NECK', NECK),
      reading('2026-09-01', 'WAIST', WAIST),
    ];

    expect(estimateBodyFatSeries(rows, MALE)).toEqual([
      { measured_on: '2026-09-01', method: 'NAVY', value: EXPECTED, carried_forward: false },
    ]);
  });

  it('returns nothing when the formula variant is unknown', () => {
    const rows = [
      reading('2026-09-01', 'NECK', NECK),
      reading('2026-09-01', 'WAIST', WAIST),
    ];

    expect(estimateBodyFatSeries(rows, { sex: null })).toEqual([]);
  });

  describe('carrying inputs forward', () => {
    // The shape this rule exists for: height and neck logged once, waist logged weekly.
    it('fills missing inputs from the most recent earlier reading and flags the point', () => {
      const rows = [
        reading('2026-06-01', 'NECK', NECK),
        reading('2026-06-01', 'WAIST', WAIST),
        reading('2026-06-15', 'WAIST', WAIST),
      ];

      const result = estimateBodyFatSeries(rows, MALE);

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({ measured_on: '2026-06-01', carried_forward: false });
      expect(result[1]).toMatchObject({ measured_on: '2026-06-15', carried_forward: true });
    });

    it('stops estimating once a carried input passes its window', () => {
      const rows = [
        reading('2026-01-01', 'NECK', NECK),
        reading('2026-01-01', 'WAIST', WAIST),
        reading('2026-03-31', 'WAIST', WAIST), // neck is 89 days old - inside the 90-day window
        reading('2026-04-02', 'WAIST', WAIST), // neck is 91 days old - outside it
      ];

      const dates = estimateBodyFatSeries(rows, MALE).map(e => e.measured_on);

      expect(dates).toEqual(['2026-01-01', '2026-03-31']);
    });

    it('prefers a reading taken on the day over an earlier one', () => {
      const rows = [
        reading('2026-09-01', 'NECK', 50),
        reading('2026-09-01', 'WAIST', WAIST),
        reading('2026-09-08', 'NECK', NECK),
        reading('2026-09-08', 'WAIST', WAIST),
      ];

      const onTheDay = estimateBodyFatSeries(rows, MALE).find(e => e.measured_on === '2026-09-08');

      // The 8th's own neck reading wins over the 1st's, so the estimate is the expected one,
      // and nothing was reused.
      expect(onTheDay).toMatchObject({ value: EXPECTED, carried_forward: false });
    });


    // An input measured later must not back-fill an earlier date: the 1st has no waist yet, so
    // it gets no estimate, while the 8th legitimately carries the waist forward from the 1st.
    it('never carries a reading backwards from the future', () => {
      const rows = [
        reading('2026-09-08', 'NECK', NECK),
        reading('2026-09-01', 'WAIST', WAIST),
      ];

      // The 1st has no neck reading and no later one may stand in for it, so only the 8th
      // estimates - carrying the waist forward from the 1st, which is within its window.
      expect(estimateBodyFatSeries(rows, MALE)).toEqual([
        { measured_on: '2026-09-08', method: 'NAVY', value: EXPECTED, carried_forward: true },
      ]);
    });
  });

  describe('dates it declines to estimate', () => {
    it('skips a date whose inputs are incomplete', () => {
      // A waist with no neck to go with it, and none earlier to carry forward.
      const rows = [reading('2026-09-01', 'WAIST', WAIST)];

      expect(estimateBodyFatSeries(rows, MALE)).toEqual([]);
    });

    it('does not raise a candidate date from a measurement no formula uses', () => {
      const rows = [
        reading('2026-09-01', 'NECK', NECK),
        reading('2026-09-01', 'WAIST', WAIST),
        reading('2026-09-05', 'BODY_WEIGHT', 79.1),
      ];

      const dates = estimateBodyFatSeries(rows, MALE).map(e => e.measured_on);

      expect(dates).toEqual(['2026-09-01']);
    });

    // Height is not a measurement, so an unset one blocks Navy outright rather than leaving a
    // date incomplete.
    it('skips Navy entirely when the profile carries no height', () => {
      const rows = [
        reading('2026-09-01', 'NECK', NECK),
        reading('2026-09-01', 'WAIST', WAIST),
      ];

      expect(estimateBodyFatSeries(rows, { sex: 'MALE' })).toEqual([]);
    });

    it('skips a date whose inputs produce no usable percentage', () => {
      const rows = [
        reading('2026-09-01', 'NECK', 40),
        reading('2026-09-01', 'WAIST', 38),
      ];

      expect(estimateBodyFatSeries(rows, MALE)).toEqual([]);
    });
  });

  describe('the female variant', () => {
    it('requires the hips', () => {
      const female = { sex: 'FEMALE' as const, height_cm: 168 };
      const rows = [
        reading('2026-09-01', 'NECK', 32),
        reading('2026-09-01', 'WAIST', 76),
      ];

      expect(estimateBodyFatSeries(rows, female)).toEqual([]);

      const withHips = [...rows, reading('2026-09-01', 'HIPS', 98)];

      expect(estimateBodyFatSeries(withHips, female)).toEqual([
        { measured_on: '2026-09-01', method: 'NAVY', value: 28.6, carried_forward: false },
      ]);
    });
  });

  it('returns the series ascending by date whatever order the rows arrive in', () => {
    const rows = [
      reading('2026-09-15', 'WAIST', WAIST),
      reading('2026-09-01', 'WAIST', WAIST),
      reading('2026-09-08', 'WAIST', WAIST),
      reading('2026-09-01', 'NECK', NECK),
    ];

    const dates = estimateBodyFatSeries(rows, MALE).map(e => e.measured_on);

    expect(dates).toEqual(['2026-09-01', '2026-09-08', '2026-09-15']);
  });

  it('returns nothing for a user with no measurements', () => {
    expect(estimateBodyFatSeries([], MALE)).toEqual([]);
  });
});

describe('estimateBodyFatSeries — skinfold methods', () => {
  const JP3_MALE = { sex: 'MALE' as const, height_cm: HEIGHT, date_of_birth: '1994-03-04' };

  const jp3Rows = (date: string) => [
    reading(date, 'SKINFOLD_CHEST', 12),
    reading(date, 'SKINFOLD_ABDOMEN', 20),
    reading(date, 'SKINFOLD_THIGH', 15),
  ];

  const jp7Rows = (date: string) => [
    reading(date, 'SKINFOLD_CHEST', 12),
    reading(date, 'SKINFOLD_MIDAXILLARY', 9),
    reading(date, 'SKINFOLD_TRICEPS', 11),
    reading(date, 'SKINFOLD_SUBSCAPULAR', 13),
    reading(date, 'SKINFOLD_ABDOMEN', 20),
    reading(date, 'SKINFOLD_SUPRAILIAC', 14),
    reading(date, 'SKINFOLD_THIGH', 15),
  ];

  it('estimates JP3 from the three male sites', () => {
    // Age 32 on this date, given the 1994 birth date.
    const result = estimateBodyFatSeries(jp3Rows('2026-09-01'), JP3_MALE);

    expect(result).toEqual([
      { measured_on: '2026-09-01', method: 'JP3', value: 14.4, carried_forward: false },
    ]);
  });

  it('estimates JP7 when all seven sites are present, alongside JP3', () => {
    const methods = estimateBodyFatSeries(jp7Rows('2026-09-01'), JP3_MALE).map(e => e.method);

    // The male JP3 sites are a subset of the seven, so both methods are computable that day.
    expect(methods).toEqual(['JP3', 'JP7']);
  });

  it('uses the female sites for the female variant', () => {
    const rows = [
      reading('2026-09-01', 'SKINFOLD_TRICEPS', 18),
      reading('2026-09-01', 'SKINFOLD_SUPRAILIAC', 14),
      reading('2026-09-01', 'SKINFOLD_THIGH', 26),
    ];

    const result = estimateBodyFatSeries(rows, { sex: 'FEMALE', height_cm: 168, date_of_birth: '1996-03-04' });

    expect(result).toEqual([
      { measured_on: '2026-09-01', method: 'JP3', value: 23.5, carried_forward: false },
    ]);
  });

  // The equations take age as a term, so without a birth date they cannot be evaluated at all.
  it('computes nothing from calipers when the birth date is unknown', () => {
    expect(estimateBodyFatSeries(jp3Rows('2026-09-01'), { sex: 'MALE' })).toEqual([]);
  });

  // A series spans birthdays; using today's age throughout would restate every past point.
  it('uses the age the user was on each date, not their age now', () => {
    const rows = [...jp3Rows('2026-03-03'), ...jp3Rows('2026-03-05')];

    const [before, after] = estimateBodyFatSeries(rows, JP3_MALE);

    // The birthday falls between the two dates, so the later estimate is the older body.
    expect(after.value).toBeGreaterThan(before.value);
  });

  // A caliper round is one sitting, so its window is far shorter than a circumference's.
  it('will not build a round from sites measured weeks apart', () => {
    const rows = [
      reading('2026-09-01', 'SKINFOLD_CHEST', 12),
      reading('2026-09-01', 'SKINFOLD_ABDOMEN', 20),
      reading('2026-09-20', 'SKINFOLD_THIGH', 15),
    ];

    expect(estimateBodyFatSeries(rows, JP3_MALE)).toEqual([]);
  });

  it('tolerates a round finished the next day', () => {
    const rows = [
      reading('2026-09-01', 'SKINFOLD_CHEST', 12),
      reading('2026-09-01', 'SKINFOLD_ABDOMEN', 20),
      reading('2026-09-02', 'SKINFOLD_THIGH', 15),
    ];

    const result = estimateBodyFatSeries(rows, JP3_MALE);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ measured_on: '2026-09-02', carried_forward: true });
  });

  // The whole point of computing every method: switching preference cannot erase history.
  it('returns tape and caliper estimates side by side when both are supported', () => {
    const rows = [
      reading('2026-09-01', 'NECK', NECK),
      reading('2026-09-01', 'WAIST', WAIST),
      ...jp3Rows('2026-09-01'),
    ];

    const methods = estimateBodyFatSeries(rows, JP3_MALE).map(e => e.method);

    expect(methods).toEqual(['JP3', 'NAVY']);
  });
});

/**
 * The site lists themselves, stated here as well as in `METHODS`.
 *
 * The web app declares the same sites again, for a different question - which boxes a method
 * ticks in Settings - and nothing spanning both packages can prove the two agree. This is the
 * closest thing: change a list here and this fails, which is the prompt to change it there too.
 * The sites come from the published equations (Hodgdon & Beckett 1984, Jackson & Pollock
 * 1978/1980) and are not expected to move.
 */
describe('what each formula reads', () => {
  it.each([
    ['NAVY', 'MALE', ['NECK', 'WAIST']],
    ['NAVY', 'FEMALE', ['NECK', 'WAIST', 'HIPS']],
    ['JP3', 'MALE', ['SKINFOLD_CHEST', 'SKINFOLD_ABDOMEN', 'SKINFOLD_THIGH']],
    ['JP3', 'FEMALE', ['SKINFOLD_TRICEPS', 'SKINFOLD_SUPRAILIAC', 'SKINFOLD_THIGH']],
  ])('should read the documented sites for %s (%s)', (method, sex, expected) => {
    expect(bodyFatMethodInputs(method as BodyFatMethod, sex as Sex)).toEqual(expected);
  });

  it('should read all seven caliper sites for JP7, whatever the variant', () => {
    expect(bodyFatMethodInputs('JP7', 'MALE')).toHaveLength(7);
    expect(bodyFatMethodInputs('JP7', 'MALE')).toEqual(bodyFatMethodInputs('JP7', 'FEMALE'));
  });

  // MANUAL derives nothing, so it must not pull BODY_FAT into the query that feeds the formulas.
  it('should not fetch a type no formula consumes', () => {
    expect(BODY_FAT_INPUT_TYPES).not.toContain('BODY_FAT');
    expect(BODY_FAT_INPUT_TYPES).not.toContain('BODY_WEIGHT');
  });
});
