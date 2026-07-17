import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SessionSetListComponent } from './session-set-list.component';
import { SessionExerciseViewModel, SessionSetViewModel } from '../../../../models/session-page.viewmodel';

const createMockSet = (overrides: Partial<SessionSetViewModel> = {}): SessionSetViewModel => ({
  id: 'set1',
  order: 1,
  status: 'PENDING',
  expectedReps: 5,
  weight: 70,
  actualReps: undefined,
  planExerciseId: 'tpex1',
  ...overrides,
});

const createMockExercise = (overrides: Partial<SessionExerciseViewModel> = {}): SessionExerciseViewModel => ({
  planExerciseId: 'tpex1',
  exerciseName: 'Squat',
  order: 1,
  plannedSetsCount: 3,
  sets: [
    createMockSet({ id: 'set1', order: 1 }),
    createMockSet({ id: 'set2', order: 2 }),
    createMockSet({ id: 'set3', order: 3 }),
  ],
  ...overrides,
});

describe('SessionSetListComponent', () => {
  let component: SessionSetListComponent;

  beforeEach(() => {
    component = new SessionSetListComponent();
    component.exercise = createMockExercise();
  });

  describe('Warmup Visibility', () => {
    it('should be collapsed with a computed ramp when all sets are PENDING', () => {
      expect(component.warmupState()).toBe('collapsed');
      expect(component.warmupSets().map(s => ({ reps: s.reps, weight: s.weight }))).toEqual([
        { reps: 5, weight: 20 },
        { reps: 5, weight: 20 },
        { reps: 5, weight: 32.5 },
        { reps: 3, weight: 45 },
        { reps: 2, weight: 57.5 },
      ]);
    });

    it('should be dismissed when any set has a non-PENDING status', () => {
      for (const status of ['COMPLETED', 'FAILED', 'SKIPPED'] as const) {
        component.exercise = createMockExercise({
          sets: [createMockSet({ id: 'set1', status }), createMockSet({ id: 'set2' })],
        });

        expect(component.warmupState(), `should be dismissed for status ${status}`).toBe('dismissed');
      }
    });

    it('should be dismissed when the session is read-only', () => {
      component.isReadOnly = true;
      expect(component.warmupState()).toBe('dismissed');
    });

    it('should be dismissed when no warmup sets can be computed', () => {
      component.exercise = createMockExercise({
        sets: [createMockSet({ weight: undefined }), createMockSet({ id: 'set2', weight: 0 })],
      });

      expect(component.warmupState()).toBe('dismissed');
      expect(component.warmupSets()).toEqual([]);
    });

    it('should compute the warmup from the heaviest set (top-set weight)', () => {
      component.exercise = createMockExercise({
        sets: [
          createMockSet({ id: 'set1', weight: 60 }),
          createMockSet({ id: 'set2', weight: 70 }),
          createMockSet({ id: 'set3', weight: 65 }),
        ],
      });

      const warmupSets = component.warmupSets();
      expect(warmupSets[warmupSets.length - 1]?.weight).toBe(57.5); // 20 + 3 * (70 - 20) / 4
    });

    it('should recompute the ramp when a set weight is edited', () => {
      component.exercise = createMockExercise({
        sets: [createMockSet({ id: 'set1', weight: 100 }), createMockSet({ id: 'set2', weight: 100 })],
      });
      expect(component.warmupSets().map(s => s.weight)).toEqual([20, 20, 40, 60, 80]);

      component.exercise = createMockExercise({
        sets: [createMockSet({ id: 'set1', weight: 50 }), createMockSet({ id: 'set2', weight: 50 })],
      });

      expect(component.warmupSets().map(s => s.weight)).toEqual([20, 20, 27.5, 35, 42.5]);
    });
  });

  describe('Warmup Interactions', () => {
    it('should expand when the toggle is clicked', () => {
      component.onWarmupToggleClicked();
      expect(component.warmupState()).toBe('expanded');
    });

    it('should remove only the clicked warmup set', () => {
      component.onWarmupToggleClicked();
      const initialSets = component.warmupSets();

      component.onWarmupSetClicked(initialSets[2].id);

      expect(component.warmupSets()).toHaveLength(initialSets.length - 1);
      expect(component.warmupSets().map(s => s.id)).not.toContain(initialSets[2].id);
      expect(component.warmupState()).toBe('expanded');
    });

    it('should dismiss when the last warmup set is removed', () => {
      component.onWarmupToggleClicked();

      for (const warmupSet of [...component.warmupSets()]) {
        component.onWarmupSetClicked(warmupSet.id);
      }

      expect(component.warmupSets()).toEqual([]);
      expect(component.warmupState()).toBe('dismissed');
    });
  });

  describe('Dismissal via Working Sets', () => {
    it('should re-emit setClicked unchanged', () => {
      const spy = vi.spyOn(component.setClicked, 'emit');
      const clickedSet = component.exercise.sets[0];

      component.onSetClicked(clickedSet);

      expect(spy).toHaveBeenCalledWith(clickedSet);
    });

    it('should dismiss when the optimistic update marks a set non-PENDING', () => {
      component.onWarmupToggleClicked();
      expect(component.warmupState()).toBe('expanded');

      // The facade applies the optimistic set update by re-binding a new exercise object.
      component.exercise = createMockExercise({
        sets: [createMockSet({ id: 'set1', status: 'COMPLETED', actualReps: 5 }), createMockSet({ id: 'set2' })],
      });

      expect(component.warmupState()).toBe('dismissed');
    });

    it('should restore the warmup UI when a failed patch reverts the set to PENDING', () => {
      component.onWarmupToggleClicked();
      const removedId = component.warmupSets()[0].id;
      component.onWarmupSetClicked(removedId);

      component.exercise = createMockExercise({
        sets: [createMockSet({ id: 'set1', status: 'COMPLETED', actualReps: 5 }), createMockSet({ id: 'set2' })],
      });
      expect(component.warmupState()).toBe('dismissed');

      // The API rejects the update and the facade restores the PENDING snapshot.
      component.exercise = createMockExercise({
        sets: [createMockSet({ id: 'set1' }), createMockSet({ id: 'set2' })],
      });

      expect(component.warmupState()).toBe('expanded');
      expect(component.warmupSets().map(s => s.id)).not.toContain(removedId);
    });
  });

  describe('Existing Behavior', () => {
    it('should re-emit setLongPressed unchanged', () => {
      const spy = vi.spyOn(component.setLongPressed, 'emit');
      const set = component.exercise.sets[1];

      component.onSetLongPressed(set);

      expect(spy).toHaveBeenCalledWith(set);
      expect(component.warmupState()).toBe('collapsed');
    });

    it('should emit setAdded with the exercise id', () => {
      const spy = vi.spyOn(component.setAdded, 'emit');

      component.onSetAdded();

      expect(spy).toHaveBeenCalledWith('tpex1');
    });
  });
});
