import { SessionSetStatus } from '@txg/shared';
import { describe, expect, it } from 'vitest';
import { buildSessionNotificationContent, findNextPendingSet, formatSetDescription } from './session-notification.utils';
import { SessionExerciseViewModel, SessionPageViewModel, SessionSetViewModel } from '../../../models/session-page.viewmodel';

function createSet(order: number, status: SessionSetStatus, overrides: Partial<SessionSetViewModel> = {}): SessionSetViewModel {
  return {
    id: `set-${order}`,
    planExerciseId: 'exercise-1',
    order,
    status,
    isPrescribed: true,
    expectedReps: 8,
    weight: 60,
    ...overrides,
  };
}

function createExercise(order: number, exerciseName: string, sets: SessionSetViewModel[]): SessionExerciseViewModel {
  return { planExerciseId: `exercise-${order}`, exerciseName, order, sets };
}

function createSession(exercises: SessionExerciseViewModel[]): SessionPageViewModel {
  return { id: 'session-1', exercises, isLoading: false, error: null, metadata: { status: 'IN_PROGRESS' } };
}

describe('session notification utils', () => {
  describe('findNextPendingSet', () => {
    it('should return the first pending set of the first exercise', () => {
      const session = createSession([
        createExercise(1, 'Bench Press', [createSet(1, 'COMPLETED'), createSet(2, 'PENDING')]),
      ]);

      expect(findNextPendingSet(session)).toMatchObject({ setNumber: 2, setCount: 2 });
    });

    it('should move on to the next exercise once one is fully worked through', () => {
      const session = createSession([
        createExercise(1, 'Bench Press', [createSet(1, 'COMPLETED'), createSet(2, 'FAILED')]),
        createExercise(2, 'Squat', [createSet(1, 'PENDING')]),
      ]);

      expect(findNextPendingSet(session)?.exercise.exerciseName).toBe('Squat');
    });

    it('should follow exercise order rather than array order', () => {
      const session = createSession([
        createExercise(2, 'Squat', [createSet(1, 'PENDING')]),
        createExercise(1, 'Bench Press', [createSet(1, 'PENDING')]),
      ]);

      expect(findNextPendingSet(session)?.exercise.exerciseName).toBe('Bench Press');
    });

    it('should follow set order rather than array order', () => {
      const session = createSession([
        createExercise(1, 'Bench Press', [createSet(2, 'PENDING'), createSet(1, 'PENDING')]),
      ]);

      expect(findNextPendingSet(session)).toMatchObject({ setNumber: 1 });
    });

    it('should treat a skipped set as done rather than pending', () => {
      const session = createSession([
        createExercise(1, 'Bench Press', [createSet(1, 'SKIPPED'), createSet(2, 'PENDING')]),
      ]);

      expect(findNextPendingSet(session)).toMatchObject({ setNumber: 2 });
    });

    it('should return null when no set is pending', () => {
      const session = createSession([
        createExercise(1, 'Bench Press', [createSet(1, 'COMPLETED')]),
      ]);

      expect(findNextPendingSet(session)).toBeNull();
    });
  });

  describe('formatSetDescription', () => {
    it('should describe reps and weight the way the session page does', () => {
      expect(formatSetDescription(createSet(1, 'PENDING'))).toBe('8 reps @ 60 kg');
    });

    it('should keep a fractional weight intact', () => {
      expect(formatSetDescription(createSet(1, 'PENDING', { weight: 62.5 }))).toBe('8 reps @ 62.5 kg');
    });

    it('should drop the weight clause for bodyweight work', () => {
      expect(formatSetDescription(createSet(1, 'PENDING', { weight: 0 }))).toBe('8 reps');
      expect(formatSetDescription(createSet(1, 'PENDING', { weight: undefined }))).toBe('8 reps');
    });
  });

  describe('buildSessionNotificationContent', () => {
    it('should title the notification with the exercise and number the set within it', () => {
      const session = createSession([
        createExercise(1, 'Bench Press', [
          createSet(1, 'COMPLETED'),
          createSet(2, 'COMPLETED'),
          createSet(3, 'PENDING'),
          createSet(4, 'PENDING'),
          createSet(5, 'PENDING'),
        ]),
        createExercise(2, 'Squat', [createSet(1, 'PENDING')]),
      ]);

      expect(buildSessionNotificationContent(session)).toEqual({
        title: 'Bench Press',
        body: 'Set 3/5 · 8 reps @ 60 kg',
      });
    });

    it('should prompt to finish once every set is done', () => {
      const session = createSession([
        createExercise(1, 'Bench Press', [createSet(1, 'COMPLETED')]),
      ]);

      expect(buildSessionNotificationContent(session)).toEqual({
        title: 'Workout in progress',
        body: 'All sets done - tap to finish',
      });
    });
  });
});
