import { describe, expect, it } from 'vitest';
import {
  BAR_WEIGHT_KG,
  DEFAULT_PLATE_DENOMINATIONS_KG,
  PLATE_DENOMINATIONS_KG,
  PlateDenominationKg,
  buildLoadTable,
  loadableStepsKg,
  nextLoadableKg,
  previousLoadableKg,
  resolveSessionWeightKg,
  sanitizeDenominations,
  snapDownToLoadableKg,
  solvePlates,
} from './plate-calculator.utils';
import { SessionExerciseViewModel } from '../../../models/session-page.viewmodel';

const tableOf = (...available: PlateDenominationKg[]) => buildLoadTable(available);
const defaultTable = () => buildLoadTable([...DEFAULT_PLATE_DENOMINATIONS_KG]);
const fullTable = () => buildLoadTable([...PLATE_DENOMINATIONS_KG]);

describe('solvePlates', () => {
  it('should load the everyday weight from the default rack', () => {
    expect(solvePlates(100, defaultTable())).toEqual({ perSide: [20, 20], remainderKg: 0 });
  });

  it('should load a fractional weight exactly', () => {
    expect(solvePlates(47.5, defaultTable())).toEqual({ perSide: [10, 2.5, 1.25], remainderKg: 0 });
  });

  it('should beat greedy when the rack does not nest', () => {
    expect(solvePlates(80, tableOf(25, 20, 15))).toEqual({ perSide: [15, 15], remainderKg: 0 });
  });

  it('should report the shortfall when the rack cannot reach the target', () => {
    expect(solvePlates(137.5, tableOf(20, 10, 5))).toEqual({ perSide: [20, 20, 10, 5], remainderKg: 7.5 });
  });

  it('should treat a bare bar as a valid answer', () => {
    expect(solvePlates(BAR_WEIGHT_KG, defaultTable())).toEqual({ perSide: [], remainderKg: 0 });
  });

  it('should treat a weight below the bar as a bare bar rather than an error', () => {
    expect(solvePlates(15, defaultTable())).toEqual({ perSide: [], remainderKg: 0 });
  });

  it('should load nothing when the rack cannot express the target at all', () => {
    expect(solvePlates(50, tableOf(20))).toEqual({ perSide: [], remainderKg: 30 });
  });

  it('should minimise the plate count rather than take the smallest plates', () => {
    expect(solvePlates(40, tableOf(10, 5)).perSide).toEqual([10]);
  });

  it('should stay exact where floating point subtraction would drift', () => {
    expect(solvePlates(30.5, tableOf(2.5, 1.5, 1.25))).toEqual({ perSide: [2.5, 1.5, 1.25], remainderKg: 0 });
  });

  it('should solve a typed weight as given, without snapping it', () => {
    expect(solvePlates(47.3, defaultTable())).toEqual({ perSide: [10, 2.5], remainderKg: 2.3 });
  });
});

describe('nextLoadableKg / previousLoadableKg', () => {
  it('should walk the loadable weights rather than a fixed step', () => {
    expect(nextLoadableKg(20, tableOf(25, 20, 15))).toBe(50);
  });

  it('should step by 2.5 kg on the default rack', () => {
    expect(nextLoadableKg(100, defaultTable())).toBe(102.5);
    expect(previousLoadableKg(100, defaultTable())).toBe(97.5);
  });

  it('should fall back to the loadable weight below an unloadable one', () => {
    expect(previousLoadableKg(47.3, defaultTable())).toBe(45);
  });

  it('should floor at the bar', () => {
    expect(previousLoadableKg(BAR_WEIGHT_KG, defaultTable())).toBe(BAR_WEIGHT_KG);
  });

  it('should stand still when nothing heavier can be loaded', () => {
    expect(nextLoadableKg(500, defaultTable())).toBe(500);
  });
});

describe('snapDownToLoadableKg', () => {
  it('should leave a loadable weight alone', () => {
    expect(snapDownToLoadableKg(102.5, defaultTable())).toBe(102.5);
  });

  it('should snap down, never up', () => {
    expect(snapDownToLoadableKg(101, defaultTable())).toBe(100);
  });

  it('should snap a weight below the bar up to the bar', () => {
    expect(snapDownToLoadableKg(10, defaultTable())).toBe(BAR_WEIGHT_KG);
  });
});

describe('loadableStepsKg', () => {
  it('should report one step for the default rack', () => {
    expect(loadableStepsKg(defaultTable())).toEqual([2.5]);
  });

  it('should report one step when 15s nest into the default rack', () => {
    expect(loadableStepsKg(tableOf(20, 15, 10, 5, 2.5, 1.25))).toEqual([2.5]);
  });

  it('should not mistake a coarse rack for an uneven one', () => {
    expect(loadableStepsKg(tableOf(20))).toEqual([40]);
  });

  it('should report an uneven rack', () => {
    expect(loadableStepsKg(tableOf(25, 20, 15))).toEqual([10, 30]);
  });

  it('should report the full ladder as uneven, because 1.25 does not nest', () => {
    expect(loadableStepsKg(fullTable())).toEqual([0.5, 1]);
  });

  it('should report the ladder without 1.25 as even', () => {
    expect(loadableStepsKg(tableOf(25, 20, 15, 10, 5, 2.5, 2, 1.5, 1, 0.5))).toEqual([1]);
  });
});

describe('sanitizeDenominations', () => {
  it('should drop values that are not denominations', () => {
    expect(sanitizeDenominations([20, 3, 1.25, 999])).toEqual([20, 1.25]);
  });

  it('should return the default rack for missing storage', () => {
    expect(sanitizeDenominations(null)).toEqual([...DEFAULT_PLATE_DENOMINATIONS_KG]);
  });

  it('should return the default rack when nothing survives', () => {
    expect(sanitizeDenominations([3, 7])).toEqual([...DEFAULT_PLATE_DENOMINATIONS_KG]);
  });

  it('should return denominations in descending order', () => {
    expect(sanitizeDenominations([1.25, 20, 5])).toEqual([20, 5, 1.25]);
  });
});

describe('resolveSessionWeightKg', () => {
  const exercise = (sets: SessionExerciseViewModel['sets']): SessionExerciseViewModel =>
    ({ planExerciseId: 'e1', exerciseName: 'Squat', order: 1, sets });

  const set = (overrides: Partial<SessionExerciseViewModel['sets'][number]>) => ({
    id: 's1',
    planExerciseId: 'e1',
    order: 1,
    status: 'PENDING' as const,
    isPrescribed: true,
    expectedReps: 5,
    ...overrides,
  });

  it('should take the first pending set', () => {
    const exercises = [exercise([
      set({ id: 's1', status: 'COMPLETED', weight: 100 }),
      set({ id: 's2', status: 'PENDING', weight: 80 }),
      set({ id: 's3', status: 'PENDING', weight: 90 }),
    ])];

    expect(resolveSessionWeightKg(exercises)).toBe(80);
  });

  it('should fall back to the heaviest logged set once nothing is pending', () => {
    const exercises = [exercise([
      set({ id: 's1', status: 'COMPLETED', weight: 60 }),
      set({ id: 's2', status: 'FAILED', weight: 105 }),
    ])];

    expect(resolveSessionWeightKg(exercises)).toBe(105);
  });

  it('should prefer an expanded warmup ramp over the working weight', () => {
    const exercises = [exercise([set({ id: 's1', status: 'PENDING', weight: 100 })])];

    expect(resolveSessionWeightKg(exercises, { e1: 32.5 })).toBe(32.5);
  });

  it('should ignore a ramp belonging to a different exercise', () => {
    const exercises = [exercise([set({ id: 's1', status: 'PENDING', weight: 100 })])];

    expect(resolveSessionWeightKg(exercises, { e2: 32.5 })).toBe(100);
  });

  it('should fall back to the bar when the session carries no weights', () => {
    expect(resolveSessionWeightKg([exercise([])])).toBe(BAR_WEIGHT_KG);
    expect(resolveSessionWeightKg([])).toBe(BAR_WEIGHT_KG);
  });
});
