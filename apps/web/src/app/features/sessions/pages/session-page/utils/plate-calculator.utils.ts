import { SessionExerciseViewModel } from '../../../models/session-page.viewmodel';

/**
 * Decomposes a working weight into the plates that go on each side of the bar.
 *
 * Everything here works in integer hundredths of a kilogram. 1.25, 1.5 and 2.5 are not exactly
 * representable in binary floating point, and this module subtracts them repeatedly - in floats,
 * 120 kg decomposed down to its last 2.5 leaves 2.4999999999999996, which then fails a `>= 1.25`
 * test at the worst possible moment. Conversion happens at the boundary and nowhere else.
 */

/** Duplicated from `WARMUP_SCHEME.barWeightKg` until #51 lands `exercises.bar_weight_kg`. */
export const BAR_WEIGHT_KG = 20;

/** A sanity cap on the stepper rather than a real limit; nobody is loading half a tonne here. */
export const MAX_WEIGHT_KG = 500;

/**
 * IWF competition discs, plus the 1.25 kg that is in every commercial gym and no rulebook.
 * Descending. The five in `DEFAULT_PLATE_DENOMINATIONS_KG` are always shown in the dialog; the
 * rest appear only while selected, or behind its "More plates" disclosure.
 */
export const PLATE_DENOMINATIONS_KG = [25, 20, 15, 10, 5, 2.5, 2, 1.5, 1.25, 1, 0.5] as const;

/** What a normal gym racks, and what the calculator assumes until told otherwise. */
export const DEFAULT_PLATE_DENOMINATIONS_KG = [20, 10, 5, 2.5, 1.25] as const;

export type PlateDenominationKg = typeof PLATE_DENOMINATIONS_KG[number];

/** The loadable weights over `bar` … `bar + this`, which is where the even-rack test looks. */
const STEP_SURVEY_RANGE_KG = 200;

const HUNDREDTHS = 100;

const DENOMINATION_BY_HUNDREDTHS = new Map<number, PlateDenominationKg>(
  PLATE_DENOMINATIONS_KG.map(kg => [toHundredths(kg), kg]),
);

/**
 * An unbounded coin-change table over the per-side load, built once per chip selection.
 *
 * A greedy solver was the first attempt and is wrong here: with 15s and 25s racked, greedy takes
 * a 25 towards 30 kg a side and strands 5 kg, where 15 + 15 is exact. Greedy is only safe while
 * each denomination divides the next larger one, which this ladder does not.
 */
export interface LoadTable {
  /** Index unit in hundredths: the GCD of the selection, so every index is a reachable load. */
  readonly unitH: number;
  /** The heaviest per-side load the table can express, as an index. */
  readonly maxIndex: number;
  /** The bar, in hundredths, so an index maps back to a total weight without the caller. */
  readonly barH: number;
  /** Fewest plates summing to exactly this index, or -1 where the index is unreachable. */
  readonly plateCount: Int32Array;
  /** The denomination (in index units) taken to reach this index, for reconstruction. */
  readonly choice: Int32Array;
}

export interface PlateSolution {
  /** Descending, i.e. rack order from the collar outward. One entry per physical plate. */
  perSide: PlateDenominationKg[];
  /** Kilograms of the requested total that could not be loaded. 0 for an exact solution. */
  remainderKg: number;
}

/**
 * Keeps only the denominations this module can actually load, so a hand-edited localStorage
 * value cannot reach the table. Falls back to the default rack when nothing survives.
 */
export function sanitizeDenominations(values: readonly number[] | null | undefined): PlateDenominationKg[] {
  if (!values || values.length === 0) {
    return [...DEFAULT_PLATE_DENOMINATIONS_KG];
  }

  const kept = PLATE_DENOMINATIONS_KG.filter(kg => values.includes(kg));
  return kept.length > 0 ? kept : [...DEFAULT_PLATE_DENOMINATIONS_KG];
}

export function buildLoadTable(
  available: readonly PlateDenominationKg[],
  barKg: number = BAR_WEIGHT_KG,
): LoadTable {
  const barH = toHundredths(barKg);
  const denominationsH = [...new Set(available.map(toHundredths))]
    .filter(h => h > 0)
    .sort((a, b) => b - a);

  if (denominationsH.length === 0) {
    return { unitH: HUNDREDTHS, maxIndex: 0, barH, plateCount: Int32Array.of(0), choice: Int32Array.of(-1) };
  }

  const unitH = denominationsH.reduce(greatestCommonDivisor);
  const maxIndex = Math.max(0, Math.floor((toHundredths(MAX_WEIGHT_KG) - barH) / 2 / unitH));

  const plateCount = new Int32Array(maxIndex + 1).fill(-1);
  const choice = new Int32Array(maxIndex + 1).fill(-1);
  const steps = denominationsH.map(h => h / unitH);

  plateCount[0] = 0;

  for (let index = 1; index <= maxIndex; index++) {
    for (const step of steps) {
      if (step > index || plateCount[index - step] < 0) continue;

      const candidate = plateCount[index - step] + 1;
      if (plateCount[index] < 0 || candidate < plateCount[index]) {
        plateCount[index] = candidate;
        choice[index] = step;
      }
    }
  }

  return { unitH, maxIndex, barH, plateCount, choice };
}

/**
 * Walks *down* from the requested load to the first index the rack can build, so the calculator
 * never quietly suggests loading more than the session asked for. The gap comes back as
 * `remainderKg` for the dialog to say out loud.
 */
export function solvePlates(totalKg: number, table: LoadTable): PlateSolution {
  const totalH = toHundredths(totalKg);
  if (totalH <= table.barH) {
    return { perSide: [], remainderKg: 0 };
  }

  const perSideH = (totalH - table.barH) / 2;
  let index = Math.min(table.maxIndex, Math.floor(perSideH / table.unitH));
  while (index > 0 && table.plateCount[index] < 0) index--;

  const perSide: PlateDenominationKg[] = [];
  for (let remaining = index; remaining > 0;) {
    const step = table.choice[remaining];
    perSide.push(toDenomination(step * table.unitH));
    remaining -= step;
  }

  perSide.sort((a, b) => b - a);

  return { perSide, remainderKg: toKilograms((perSideH - index * table.unitH) * 2) };
}

/** The next weight the rack can build above `fromKg`, or `fromKg` when there is none. */
export function nextLoadableKg(fromKg: number, table: LoadTable): number {
  const fromH = toHundredths(fromKg);
  const maxH = toHundredths(MAX_WEIGHT_KG);

  for (let index = indexOf(fromH, table) + 1; index <= table.maxIndex; index++) {
    if (table.plateCount[index] < 0) continue;

    const weightH = weightAt(index, table);
    if (weightH > maxH) break;

    return toKilograms(weightH);
  }

  return fromKg;
}

/** The last weight the rack can build below `fromKg`. The bar is the floor. */
export function previousLoadableKg(fromKg: number, table: LoadTable): number {
  const fromH = toHundredths(fromKg);
  if (fromH <= table.barH) {
    return toKilograms(table.barH);
  }

  let index = Math.min(table.maxIndex, indexOf(fromH, table));
  if (weightAt(index, table) >= fromH) index--;

  for (; index > 0; index--) {
    if (table.plateCount[index] >= 0) return toKilograms(weightAt(index, table));
  }

  return toKilograms(table.barH);
}

/**
 * The heaviest loadable weight at or below `kg`. Applied to the weight the session prescribes and
 * to a weight left stranded by a chip change - never to one the user typed, which is answered
 * with a shortfall instead of being moved.
 */
export function snapDownToLoadableKg(kg: number, table: LoadTable): number {
  const targetH = toHundredths(kg);
  if (targetH <= table.barH) {
    return toKilograms(table.barH);
  }

  let index = Math.min(table.maxIndex, indexOf(targetH, table));
  while (index > 0 && table.plateCount[index] < 0) index--;

  return toKilograms(weightAt(index, table));
}

/**
 * Distinct gaps between consecutive loadable weights, ascending. One value is an even rack; more
 * than one means the stepper jumps by different amounts depending on where the user is standing.
 *
 * This measures the symptom rather than testing whether each denomination divides the next larger
 * one. That test is wrong here: it flags {20, 15, 10, 5, 2.5, 1.25}, which steps a flat 2.5 kg.
 */
export function loadableStepsKg(table: LoadTable): number[] {
  const limitH = table.barH + toHundredths(STEP_SURVEY_RANGE_KG);
  const steps = new Set<number>();
  let previousH: number | null = null;

  for (let index = 0; index <= table.maxIndex; index++) {
    if (table.plateCount[index] < 0) continue;

    const weightH = weightAt(index, table);
    if (weightH > limitH) break;

    if (previousH !== null) steps.add(weightH - previousH);
    previousH = weightH;
  }

  return [...steps].sort((a, b) => a - b).map(toKilograms);
}

/**
 * The weight the calculator opens on: the next set the session calls for, then the heaviest set
 * logged in it, then the bare bar.
 *
 * `expandedWarmupWeightsKg` maps an exercise to the lightest set still on its warmup ramp, for the
 * exercises showing one. A ramp on screen outranks the working weight, because it is what actually
 * goes on the bar next - the working weight is several sets away.
 */
export function resolveSessionWeightKg(
  exercises: readonly SessionExerciseViewModel[],
  expandedWarmupWeightsKg: Readonly<Record<string, number>> = {},
): number {
  const sets = exercises.flatMap(exercise => exercise.sets ?? []);

  const pending = sets.find(set => set.status === 'PENDING' && !!set.weight);
  if (pending?.weight) {
    return expandedWarmupWeightsKg[pending.planExerciseId] ?? pending.weight;
  }

  const heaviest = sets.reduce((max, set) => Math.max(max, set.weight ?? 0), 0);
  return heaviest > 0 ? heaviest : BAR_WEIGHT_KG;
}

function indexOf(weightH: number, table: LoadTable): number {
  return weightH <= table.barH ? 0 : Math.floor((weightH - table.barH) / 2 / table.unitH);
}

function weightAt(index: number, table: LoadTable): number {
  return table.barH + 2 * index * table.unitH;
}

function toDenomination(hundredths: number): PlateDenominationKg {
  return DENOMINATION_BY_HUNDREDTHS.get(hundredths)!;
}

function toHundredths(kg: number): number {
  return Math.round(kg * HUNDREDTHS);
}

function toKilograms(hundredths: number): number {
  return Math.round(hundredths) / HUNDREDTHS;
}

function greatestCommonDivisor(a: number, b: number): number {
  while (b !== 0) {
    const remainder = a % b;
    a = b;
    b = remainder;
  }
  return a;
}
