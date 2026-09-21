import { MEASUREMENT_TYPES } from '@txg/shared';
import { describe, expect, it } from 'vitest';
import {
  defaultSelectedSeriesIds,
  describeEstimateBlocker,
  estimateSeriesId,
  mapToLastValues,
  groupByInstrument,
  instrumentOf,
  mapToMeasurementSeries,
  resolveTrackedTypes,
} from './measurements.mapping';
import type { BodyFatEstimateDto, MeasurementDto, MeasurementType, ProfileDto } from '@txg/shared';

function measurement(overrides: Partial<MeasurementDto>): MeasurementDto {
  return {
    id: crypto.randomUUID(),
    user_id: 'user-1',
    measured_on: '2026-09-01',
    type: 'WAIST',
    value: 84.5,
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
    ...overrides,
  } as MeasurementDto;
}

function profile(overrides: Partial<ProfileDto> = {}): ProfileDto {
  return {
    id: 'user-1',
    first_name: 'Test',
    active_plan_id: null,
    created_at: null,
    updated_at: null,
    date_of_birth: null,
    body_fat_method: 'NAVY',
    sex: 'MALE',
    height_cm: 183,
    measurement_frequency_days: 7,
    ...overrides,
  } as ProfileDto;
}

const estimate = (measured_on: string, value: number, carried_forward = false): BodyFatEstimateDto =>
  ({ measured_on, method: 'NAVY', value, carried_forward });

const selectAll = () => true;


describe('mapToMeasurementSeries', () => {
  it('builds one series per measured type, ascending by date', () => {
    const rows = [
      measurement({ measured_on: '2026-09-08', type: 'WAIST', value: 84.0 }),
      measurement({ measured_on: '2026-09-01', type: 'WAIST', value: 84.5 }),
      measurement({ measured_on: '2026-09-01', type: 'BODY_WEIGHT', value: 79.1 }),
    ];

    const series = mapToMeasurementSeries(rows, [], selectAll);

    expect(series.map(s => s.id)).toEqual(['BODY_WEIGHT', 'WAIST']);
    expect(series.find(s => s.id === 'WAIST')!.points.map(p => p.date))
      .toEqual(['2026-09-01', '2026-09-08']);
  });

  it('carries each type its own unit and label', () => {
    const rows = [
      measurement({ type: 'BODY_WEIGHT', value: 79.1 }),
      measurement({ type: 'WAIST', value: 84.5 }),
    ];

    const series = mapToMeasurementSeries(rows, [], selectAll);

    expect(series.find(s => s.id === 'BODY_WEIGHT')).toMatchObject({ unit: 'kg', label: 'Body weight' });
    expect(series.find(s => s.id === 'WAIST')).toMatchObject({ unit: 'cm', label: 'Waist' });
  });

  it('adds an estimate series, keyed separately from the measured types', () => {
    const series = mapToMeasurementSeries(
      [measurement({ type: 'WAIST', value: 84 })],
      [estimate('2026-09-01', 26.8)],
      selectAll,
      'NAVY'
    );

    // The estimate outranks a plain measurement: it is the number the method exists to produce.
    expect(series.map(s => s.id)).toEqual([estimateSeriesId('NAVY'), 'WAIST']);
    expect(estimateSeriesId('NAVY')).not.toContain(':');
    expect(series.map(s => s.kind)).toEqual(['ESTIMATED', 'MEASURED']);
  });

  it('preserves the carried-forward flag so the chart can draw those points differently', () => {
    const series = mapToMeasurementSeries([], [estimate('2026-09-08', 26.1, true)], selectAll, 'NAVY');

    expect(series[0].points[0].carriedForward).toBe(true);
  });

  it('gives every series a distinct colour token, right up to the end of the palette', () => {
    // Body weight, the eight tape sites and the estimate come to exactly the palette's ten. A
    // count of its own here wrapped at eight, putting body weight and biceps on the same blue.
    const rows = ([
      'BODY_WEIGHT', 'NECK', 'CHEST', 'WAIST', 'HIPS', 'THIGH', 'CALF', 'BICEPS', 'FOREARM',
    ] as MeasurementType[]).map(type => measurement({ type }));

    const tokens = mapToMeasurementSeries(rows, [estimate('2026-09-01', 26.8)], selectAll, 'NAVY')
      .map(s => s.colorToken);

    expect(tokens.length).toBe(10);
    expect(new Set(tokens).size).toBe(tokens.length);
  });

  it('keeps a series selected across a reload', () => {
    const rows = [measurement({ type: 'BODY_WEIGHT' }), measurement({ type: 'WAIST' })];

    const series = mapToMeasurementSeries(rows, [], id => id === 'WAIST');

    expect(series.find(s => s.id === 'WAIST')!.selected).toBe(true);
    expect(series.find(s => s.id === 'BODY_WEIGHT')!.selected).toBe(false);
  });
});

describe('defaultSelectedSeriesIds', () => {
  it('selects body weight and the chosen estimate', () => {
    const selected = defaultSelectedSeriesIds('NAVY');

    expect([...selected].sort()).toEqual(['BODY_WEIGHT', estimateSeriesId('NAVY')].sort());
  });

  it('selects body weight alone when no method is chosen', () => {
    expect([...defaultSelectedSeriesIds(null)]).toEqual(['BODY_WEIGHT']);
  });
});

describe('mapToLastValues', () => {
  it('keeps the most recent reading per type', () => {
    const rows = [
      measurement({ measured_on: '2026-09-01', type: 'WAIST', value: 84.5 }),
      measurement({ measured_on: '2026-09-08', type: 'WAIST', value: 84.0 }),
      measurement({ measured_on: '2026-09-04', type: 'NECK', value: 38.6 }),
    ];

    expect(mapToLastValues(rows)).toEqual({
      WAIST: { value: 84.0, measuredOn: '2026-09-08' },
      NECK: { value: 38.6, measuredOn: '2026-09-04' },
    });
  });

  it('returns nothing for a user with no measurements', () => {
    expect(mapToLastValues([])).toEqual({});
  });
});

describe('describeEstimateBlocker', () => {
  it('says nothing when estimates exist', () => {
    expect(describeEstimateBlocker(profile(), [], [estimate('2026-09-01', 26.8)])).toBeNull();
  });

  it('says nothing when no method is chosen', () => {
    expect(describeEstimateBlocker(profile({ body_fat_method: null }), [], [])).toBeNull();
  });

  it('names the missing sex first', () => {
    const reason = describeEstimateBlocker(profile({ sex: null }), [], []);

    expect(reason).toContain('Settings');
    expect(reason).toContain('sex');
  });

  it('names a missing height before missing tape readings', () => {
    const rows = [measurement({ type: 'NECK' }), measurement({ type: 'WAIST' })];

    expect(describeEstimateBlocker(profile({ height_cm: null }), rows, [])).toContain('height');
  });

  it('names exactly which tape readings are missing', () => {
    const reason = describeEstimateBlocker(profile(), [], []);

    expect(reason).toContain('neck');
    expect(reason).toContain('waist');
  });

  it('asks the female variant for hips too', () => {
    const rows = [
      measurement({ type: 'NECK', value: 32 }),
      measurement({ type: 'WAIST', value: 76 }),
    ];

    expect(describeEstimateBlocker(profile({ sex: 'FEMALE', height_cm: 168 }), rows, [])).toContain('hips');
  });

  it('falls back to a stale-data message when every input is present', () => {
    const rows = [
      measurement({ type: 'NECK', value: 38.6 }),
      measurement({ type: 'WAIST', value: 102.1 }),
    ];

    expect(describeEstimateBlocker(profile(), rows, [])).toContain('fresh round');
  });
});

describe('describeEstimateBlocker — skinfold methods', () => {
  const jp3 = (overrides = {}) => profile({ body_fat_method: 'JP3', date_of_birth: '1994-03-04', ...overrides });

  // The skinfold equations take age as a term, so they cannot run at all without a birth date.
  it('asks for a date of birth before anything else', () => {
    const rows = [
      measurement({ type: 'SKINFOLD_CHEST', value: 12 }),
      measurement({ type: 'SKINFOLD_ABDOMEN', value: 20 }),
      measurement({ type: 'SKINFOLD_THIGH', value: 15 }),
    ];

    expect(describeEstimateBlocker(jp3({ date_of_birth: null }), rows, [])).toContain('date of birth');
  });

  // Height is a Navy input; a caliper method must not demand it.
  it('does not ask a caliper user for their height', () => {
    const reason = describeEstimateBlocker(jp3(), [measurement({ type: 'BODY_WEIGHT', value: 79.1 })], []);

    expect(reason).not.toContain('height');
    expect(reason).toContain('skinfold');
  });

  it('names the male caliper sites that are missing', () => {
    const reason = describeEstimateBlocker(jp3(), [measurement({ type: 'SKINFOLD_CHEST', value: 12 })], []);

    expect(reason).toContain('abdomen skinfold');
    expect(reason).toContain('thigh skinfold');
    expect(reason).not.toContain('chest skinfold');
  });

  it('names the female caliper sites for the female variant', () => {
    const reason = describeEstimateBlocker(jp3({ sex: 'FEMALE' }), [], []);

    expect(reason).toContain('triceps skinfold');
    expect(reason).toContain('suprailiac skinfold');
  });

  it('asks a JP7 user for all seven sites', () => {
    const reason = describeEstimateBlocker(jp3({ body_fat_method: 'JP7' }), [], []);

    expect(reason).toContain('midaxillary skinfold');
    expect(reason).toContain('subscapular skinfold');
  });
});

describe('mapToMeasurementSeries — skinfold series', () => {
  const everyEstimate = [
    { measured_on: '2026-09-01', method: 'NAVY' as const, value: 26.8, carried_forward: false },
    { measured_on: '2026-09-01', method: 'JP3' as const, value: 14.4, carried_forward: false },
    { measured_on: '2026-09-01', method: 'JP7' as const, value: 14.0, carried_forward: false },
  ];

  // The API computes every method the readings support; the chart draws the chosen one, so the
  // reader is comparing a body against itself rather than three formulas against each other.
  it('charts only the chosen method', () => {
    const series = mapToMeasurementSeries([], everyEstimate, selectAll, 'JP7');

    expect(series.map(s => s.id)).toEqual([estimateSeriesId('JP7')]);
  });

  it('charts no estimate at all until a method is chosen', () => {
    expect(mapToMeasurementSeries([], everyEstimate, selectAll, null)).toEqual([]);
  });



  // Nothing is stored, so switching back recomputes the other series from the same readings.
  it('hides a line rather than discarding a history', () => {
    const navyOnly = mapToMeasurementSeries([], everyEstimate, selectAll, 'NAVY');
    const backToJp7 = mapToMeasurementSeries([], everyEstimate, selectAll, 'JP7');

    expect(navyOnly.map(s => s.id)).toEqual([estimateSeriesId('NAVY')]);
    expect(backToJp7[0].points).toHaveLength(1);
  });

  // Calipers are millimetres; the chart's two-axis rule depends on that being right. A caliper
  // method is required for the site to earn a chip at all.
  it('carries millimetres for a caliper site', () => {
    const series = mapToMeasurementSeries(
      [measurement({ type: 'SKINFOLD_CHEST', value: 12 })], [], selectAll, 'JP7', ['SKINFOLD_CHEST']
    );

    expect(series[0]).toMatchObject({ unit: 'mm', label: 'Chest skinfold' });
  });
});

describe('mapToMeasurementSeries — what the user tracks', () => {
  const rows = [
    measurement({ type: 'BODY_WEIGHT', value: 79 }),
    measurement({ type: 'WAIST', value: 84 }),
    measurement({ type: 'SKINFOLD_CHEST', value: 12 }),
  ];

  it('offers only the tracked types', () => {
    const ids = mapToMeasurementSeries(rows, [], selectAll, null, ['BODY_WEIGHT', 'WAIST']).map(s => s.id);

    expect(ids).toEqual(['BODY_WEIGHT', 'WAIST']);
  });

  it('offers a caliper site when it is tracked', () => {
    const ids = mapToMeasurementSeries(rows, [], selectAll, null, ['SKINFOLD_CHEST']).map(s => s.id);

    expect(ids).toEqual(['SKINFOLD_CHEST']);
  });

});

describe('groupByInstrument', () => {
  const flat = (types: MeasurementType[]) =>
    groupByInstrument(types).map(g => [g.instrument, g.types] as const);

  // The order a round is actually taken in, and the order every surface presents.
  it('should run scale, then tape, then calipers', () => {
    expect(flat(['SKINFOLD_CHEST', 'WAIST', 'BODY_WEIGHT'])).toEqual([
      ['Scale', ['BODY_WEIGHT']],
      ['Tape', ['WAIST']],
      ['Calipers', ['SKINFOLD_CHEST']],
    ]);
  });

  it('should order within a group by the catalog, not by the argument', () => {
    expect(groupByInstrument(['BICEPS', 'NECK', 'WAIST'])[0].types).toEqual(['NECK', 'WAIST', 'BICEPS']);
  });

  it('should drop a group nothing falls into', () => {
    expect(groupByInstrument(['BODY_WEIGHT']).map(g => g.instrument)).toEqual(['Scale']);
  });

  it('should return nothing for nothing', () => {
    expect(groupByInstrument([])).toEqual([]);
  });

  // A skinfold and a circumference can name the same site; the instrument tells them apart.
  it('should file a skinfold under calipers and its namesake under tape', () => {
    expect(instrumentOf('SKINFOLD_CHEST')).toBe('Calipers');
    expect(instrumentOf('CHEST')).toBe('Tape');
    expect(instrumentOf('BODY_WEIGHT')).toBe('Scale');
  });
});

/**
 * `MANUAL` records a figure rather than computing one, so it has no estimate series, nothing that
 * can block it, and its line is an ordinary stored series drawn solid rather than dashed.
 */
describe('the manual body-fat method', () => {
  const profile = (overrides: Partial<ProfileDto>) =>
    ({ body_fat_method: 'MANUAL', sex: null, height_cm: null, date_of_birth: null, ...overrides }) as ProfileDto;

  it('should chart a typed-in reading as a measured series', () => {
    const series = mapToMeasurementSeries(
      [measurement({ type: 'BODY_FAT', value: 18.4 })], [], selectAll, 'MANUAL', ['BODY_FAT']
    );

    expect(series).toHaveLength(1);
    expect(series[0]).toMatchObject({ id: 'BODY_FAT', kind: 'MEASURED', unit: 'BF%', shortLabel: 'Body fat' });
  });

  // It sits where a derived estimate would: second, right after body weight.
  it('should rank it with the estimate rather than with the tape', () => {
    const rows = [
      measurement({ type: 'WAIST', value: 84 }),
      measurement({ type: 'BODY_FAT', value: 18.4 }),
      measurement({ type: 'BODY_WEIGHT', value: 79 }),
    ];

    const ids = mapToMeasurementSeries(rows, [], selectAll, 'MANUAL', ['BODY_WEIGHT', 'BODY_FAT', 'WAIST'])
      .map(s => s.id);

    expect(ids).toEqual(['BODY_WEIGHT', 'BODY_FAT', 'WAIST']);
  });

  it('should need no formula variant and report no blocker', () => {
    expect(describeEstimateBlocker(profile({}), [], [])).toBeNull();
  });

  it('should select the stored series by default, not an estimate id', () => {
    expect([...defaultSelectedSeriesIds('MANUAL')]).toEqual(['BODY_WEIGHT', 'BODY_FAT']);
  });

  // A typed-in percentage comes off the scale, like the weight beside it.
  it('should group under the scale', () => {
    expect(instrumentOf('BODY_FAT')).toBe('Scale');
    expect(groupByInstrument(['BODY_FAT', 'WAIST'])[0]).toEqual({ instrument: 'Scale', types: ['BODY_FAT'] });
  });
});

describe('resolveTrackedTypes', () => {
  const logged: MeasurementType[] = ['WAIST', 'SKINFOLD_CHEST'];

  it('uses the stored set when there is one', () => {
    expect(resolveTrackedTypes(['WAIST', 'BODY_WEIGHT'], logged)).toEqual(['BODY_WEIGHT', 'WAIST']);
  });

  // An account created before the setting existed keeps seeing what it has logged.
  it('infers from what was logged when unset', () => {
    expect(resolveTrackedTypes(null, logged)).toEqual(['BODY_WEIGHT', 'WAIST', 'SKINFOLD_CHEST']);
  });

  // The bug this function exists to kill: the chart read `[]` as "nothing" while the log dialog
  // read it as "not chosen", so a first save from an empty checklist emptied the chart.
  it('treats an empty stored set as unset, exactly as null', () => {
    expect(resolveTrackedTypes([], logged)).toEqual(resolveTrackedTypes(null, logged));
  });

  it('always offers body weight, even to a user who has logged nothing', () => {
    expect(resolveTrackedTypes(null, [])).toEqual(['BODY_WEIGHT']);
  });

  it('returns them in catalog order whatever order they were stored in', () => {
    expect(resolveTrackedTypes(['SKINFOLD_CHEST', 'BICEPS', 'NECK'], []))
      .toEqual(['NECK', 'BICEPS', 'SKINFOLD_CHEST']);
  });
});

describe('mapToMeasurementSeries — chip order', () => {
  // The row shows three lines at a time, so order decides what is reachable without scrolling.
  it('leads with body weight, then the estimate, then the rest', () => {
    const rows = [
      measurement({ type: 'BICEPS', value: 35 }),
      measurement({ type: 'WAIST', value: 84 }),
      measurement({ type: 'BODY_WEIGHT', value: 79 }),
      measurement({ type: 'NECK', value: 38 }),
      measurement({ type: 'CHEST', value: 104 }),
    ];

    const ids = mapToMeasurementSeries(rows, [estimate('2026-09-01', 26.8)], selectAll, 'NAVY')
      .map(s => s.id);

    expect(ids.slice(0, 2)).toEqual(['BODY_WEIGHT', estimateSeriesId('NAVY')]);
    // Tape sites in MEASUREMENT_TYPES order, which is the order the Settings checklist lists them.
    expect(ids.slice(2)).toEqual(['NECK', 'CHEST', 'WAIST', 'BICEPS']);
  });

  it('puts the tape before the calipers, whatever the rows arrive in', () => {
    const rows = [
      measurement({ type: 'SKINFOLD_THIGH', value: 15 }),
      measurement({ type: 'BICEPS', value: 35 }),
      measurement({ type: 'SKINFOLD_CHEST', value: 9 }),
      measurement({ type: 'BODY_WEIGHT', value: 79 }),
      measurement({ type: 'NECK', value: 38 }),
    ];

    const ids = mapToMeasurementSeries(rows, [], selectAll, 'JP3').map(s => s.id);

    expect(ids).toEqual(['BODY_WEIGHT', 'NECK', 'BICEPS', 'SKINFOLD_CHEST', 'SKINFOLD_THIGH']);
  });

  // The chip row and the Settings checklist are built from one list, so they cannot disagree.
  it('orders every type the way MEASUREMENT_TYPES does', () => {
    const shuffled = [...MEASUREMENT_TYPES]
      .reverse()
      .map(type => measurement({ type, value: 10 }));

    const ids = mapToMeasurementSeries(shuffled, [], selectAll, null).map(s => s.id);

    expect(ids).toEqual([...MEASUREMENT_TYPES]);
  });
});
