import { describe, it, expect } from 'vitest';
import { selectCurrentSet } from './session-page.selectors';
import { SessionPageViewModel, SessionSetViewModel } from './session-page.viewmodel';

const set = (over: Partial<SessionSetViewModel>): SessionSetViewModel => ({
  id: 'set',
  planExerciseId: 'ex',
  order: 1,
  status: 'PENDING',
  expectedReps: 5,
  ...over,
});

const viewModel = (exercises: SessionPageViewModel['exercises']): SessionPageViewModel => ({
  id: 's1',
  isLoading: false,
  error: null,
  metadata: {},
  exercises,
});

describe('selectCurrentSet', () => {
  it('returns the first PENDING set of the first exercise (by order)', () => {
    const vm = viewModel([
      { planExerciseId: 'b', exerciseName: 'Bench', order: 2, plannedSetsCount: 1, sets: [set({ id: 'b1', order: 1 })] },
      {
        planExerciseId: 'a', exerciseName: 'Squat', order: 1, plannedSetsCount: 2,
        sets: [set({ id: 'a1', order: 1, status: 'COMPLETED' }), set({ id: 'a2', order: 2 })],
      },
    ]);

    const current = selectCurrentSet(vm);

    expect(current?.exercise.exerciseName).toBe('Squat');
    expect(current?.set.id).toBe('a2');
  });

  it('skips fully-completed exercises', () => {
    const vm = viewModel([
      {
        planExerciseId: 'a', exerciseName: 'Squat', order: 1, plannedSetsCount: 1,
        sets: [set({ id: 'a1', order: 1, status: 'COMPLETED' })],
      },
      { planExerciseId: 'b', exerciseName: 'Bench', order: 2, plannedSetsCount: 1, sets: [set({ id: 'b1', order: 1 })] },
    ]);

    expect(selectCurrentSet(vm)?.set.id).toBe('b1');
  });

  it('returns null when no pending sets remain', () => {
    const vm = viewModel([
      {
        planExerciseId: 'a', exerciseName: 'Squat', order: 1, plannedSetsCount: 1,
        sets: [set({ id: 'a1', order: 1, status: 'FAILED' })],
      },
    ]);

    expect(selectCurrentSet(vm)).toBeNull();
  });
});
