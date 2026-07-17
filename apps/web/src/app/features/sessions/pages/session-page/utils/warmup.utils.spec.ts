import { describe, it, expect } from 'vitest';
import { calculateWarmupSets, WARMUP_SCHEME } from './warmup.utils';

describe('calculateWarmupSets', () => {
  it('should compute the canonical even-jump ramp for a 70 kg working weight', () => {
    const sets = calculateWarmupSets(70);

    expect(sets.map(s => ({ reps: s.reps, weight: s.weight }))).toMatchInlineSnapshot(`
      [
        {
          "reps": 5,
          "weight": 20,
        },
        {
          "reps": 5,
          "weight": 20,
        },
        {
          "reps": 5,
          "weight": 32.5,
        },
        {
          "reps": 3,
          "weight": 45,
        },
        {
          "reps": 2,
          "weight": 57.5,
        },
      ]
    `);
  });

  it('should round ramp weights to the nearest weight step for non-round working weights', () => {
    const sets = calculateWarmupSets(67.5);

    const rampWeights = sets.slice(WARMUP_SCHEME.barSets.count).map(s => s.weight);
    expect(rampWeights).toEqual([32.5, 45, 55]);
    for (const set of sets) {
      expect(set.weight % WARMUP_SCHEME.weightStepKg, `weight ${set.weight} should be a multiple of the step`).toBe(0);
    }
  });

  it('should return an empty list when the working weight does not exceed the bar', () => {
    expect(calculateWarmupSets(20)).toEqual([]);
    expect(calculateWarmupSets(15)).toEqual([]);
  });

  it('should return an empty list for missing or zero working weight', () => {
    expect(calculateWarmupSets(undefined)).toEqual([]);
    expect(calculateWarmupSets(0)).toEqual([]);
  });

  it('should drop colliding ramp sets for working weights slightly above the bar', () => {
    const sets = calculateWarmupSets(25);

    expect(sets.map(s => ({ reps: s.reps, weight: s.weight }))).toEqual([
      { reps: 5, weight: 20 },
      { reps: 5, weight: 20 },
      { reps: 5, weight: 22.5 },
    ]);
  });

  it('should keep only the bar sets when every rounded ramp weight collides', () => {
    const sets = calculateWarmupSets(22.5);

    expect(sets.map(s => ({ reps: s.reps, weight: s.weight }))).toEqual([
      { reps: 5, weight: 20 },
      { reps: 5, weight: 20 },
    ]);
  });

  it('should produce strictly increasing ramp weights below the working weight', () => {
    for (const workingWeight of [25, 30, 42.5, 60, 100, 137.5, 250]) {
      const rampWeights = calculateWarmupSets(workingWeight)
        .slice(WARMUP_SCHEME.barSets.count)
        .map(s => s.weight);

      for (let i = 0; i < rampWeights.length; i++) {
        const previous = i === 0 ? WARMUP_SCHEME.barWeightKg : rampWeights[i - 1];
        expect(rampWeights[i], `ramp weights for ${workingWeight} kg should increase`).toBeGreaterThan(previous);
        expect(rampWeights[i], `ramp weights for ${workingWeight} kg should stay below the working weight`).toBeLessThan(workingWeight);
      }
    }
  });

  it('should assign a unique id to every returned set', () => {
    const sets = calculateWarmupSets(70);
    const ids = new Set(sets.map(s => s.id));

    expect(ids.size).toBe(sets.length);
  });
});
