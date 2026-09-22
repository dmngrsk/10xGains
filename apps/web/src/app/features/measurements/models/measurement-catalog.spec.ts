import { MEASUREMENT_TYPES } from '@txg/shared';
import { describe, expect, it } from 'vitest';
import { BODY_FAT_METHOD_REQUIREMENTS, MEASUREMENT_TYPE_META } from './measurement-catalog';
import type { BodyFatMethod, Sex } from '@txg/shared';

/**
 * The site lists, stated here as well as in `BODY_FAT_METHOD_REQUIREMENTS`.
 *
 * The API declares the same sites again for its formulas, and nothing spanning both packages can
 * prove the two agree - so each side pins its own list to the published equations (Hodgdon &
 * Beckett 1984, Jackson & Pollock 1978/1980). Change a list here and this fails, which is the
 * prompt to check `METHODS` in `apps/api/src/services/body-composition` too.
 */
describe('what each method asks the user to track', () => {
  const sitesFor = (method: BodyFatMethod, sex: Sex) =>
    BODY_FAT_METHOD_REQUIREMENTS[method].measurements(sex);

  it.each([
    ['NAVY', 'MALE', ['NECK', 'WAIST']],
    ['NAVY', 'FEMALE', ['NECK', 'WAIST', 'HIPS']],
    ['JP3', 'MALE', ['SKINFOLD_CHEST', 'SKINFOLD_ABDOMEN', 'SKINFOLD_THIGH']],
    ['JP3', 'FEMALE', ['SKINFOLD_TRICEPS', 'SKINFOLD_SUPRAILIAC', 'SKINFOLD_THIGH']],
  ])('should ask for the documented sites under %s (%s)', (method, sex, expected) => {
    expect(sitesFor(method as BodyFatMethod, sex as Sex)).toEqual(expected);
  });

  it('should ask for all seven caliper sites under JP7, whatever the variant', () => {
    expect(sitesFor('JP7', 'MALE')).toHaveLength(7);
    expect(sitesFor('JP7', 'MALE')).toEqual(sitesFor('JP7', 'FEMALE'));
  });

  /**
   * The entry that a single shared table could not describe honestly: MANUAL reads nothing, yet
   * still has to ask for something. "What a formula consumes" and "what to ask the user for" are
   * two questions, and here they disagree.
   */
  it('should ask for a typed-in figure under MANUAL, which derives nothing', () => {
    expect(sitesFor('MANUAL', 'MALE')).toEqual(['BODY_FAT']);
    expect(BODY_FAT_METHOD_REQUIREMENTS.MANUAL).toMatchObject({ sex: false, age: false, height: false });
  });

  // Height is a profile column, so it can never appear in a list of measurement types.
  it('should only name types the catalog admits', () => {
    for (const method of Object.keys(BODY_FAT_METHOD_REQUIREMENTS) as BodyFatMethod[]) {
      for (const sex of ['MALE', 'FEMALE'] as Sex[]) {
        expect(MEASUREMENT_TYPES).to.include.members([...sitesFor(method, sex)]);
      }
    }
  });
});

describe('MEASUREMENT_TYPE_META', () => {
  // Typed as a Record, so a missing entry is a compile error; this catches an empty one.
  it('should label and unit every type in the catalog', () => {
    for (const type of MEASUREMENT_TYPES) {
      const meta = MEASUREMENT_TYPE_META[type];

      expect(meta.label, type).to.have.length.greaterThan(0);
      expect(meta.shortLabel, type).to.have.length.greaterThan(0);
      expect(meta.unit, type).to.be.oneOf(['kg', 'cm', 'mm', 'BF%']);
    }
  });
});
