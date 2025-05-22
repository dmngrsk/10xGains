import { WritableSignal, effect } from '@angular/core';
import { describe, it, expect, vi, beforeEach, MockedFunction } from 'vitest';
import { SessionSetBubbleComponent } from './session-set-bubble.component';
import { SessionSetViewModel } from '../../../models/session-view.models';

vi.mock('@angular/core', async (importOriginal) => {
  const actualCore = await importOriginal<typeof import('@angular/core')>();
  return { ...actualCore, effect: vi.fn() };
});

const createMockSet = (overrides: Partial<SessionSetViewModel> = {}): SessionSetViewModel => ({
  id: 'set1',
  order: 1,
  status: 'PENDING',
  expectedReps: 10,
  weight: 100,
  actualReps: undefined,
  trainingPlanExerciseId: 'tpex1',
  ...overrides,
});

describe('SessionSetBubbleComponent', () => {
  let component: SessionSetBubbleComponent;
  let effectSpy: MockedFunction<typeof effect>;

  beforeEach(() => {
    effectSpy = vi.mocked(effect);
    effectSpy.mockClear();

    component = new SessionSetBubbleComponent();
    initializeComponentSet(createMockSet());
  });

  const initializeComponentSet = (set: SessionSetViewModel) => {
    component.set = set;
    (component['optimisticSet'] as WritableSignal<SessionSetViewModel>).set(set);
  };

  describe('Initialization and Defaults', () => {
    it('should create and effect should be called in constructor', () => {
      expect(component).toBeTruthy();
      expect(effectSpy).toHaveBeenCalledTimes(1);
    });

    it('should have default isAddAction as false', () => {
      expect(component.isAddAction).toBe(false);
    });

    it('should have default isReadOnly as false', () => {
      expect(component.isReadOnly).toBe(false);
    });

    it('should initialize optimisticSet with the input set via helper', () => {
      const initialSet = createMockSet({ id: 'initSet' });
      initializeComponentSet(initialSet);
      expect(component['optimisticSet']()).toEqual(initialSet);
    });
  });

  describe('Add Set', () => {
    beforeEach(() => {
      component.isAddAction = true;
      component.isReadOnly = false;
      initializeComponentSet(createMockSet());
    });

    it('should emit setAdded event when onAddClicked is called and not read-only', () => {
      const spy = vi.spyOn(component.setAdded, 'emit');
      component.onAddClicked();
      expect(spy).toHaveBeenCalledOnce();
    });

    it('should NOT emit setAdded event when onAddClicked is called and is read-only', () => {
      component.isReadOnly = true;
      const spy = vi.spyOn(component.setAdded, 'emit');
      component.onAddClicked();
      expect(spy).not.toHaveBeenCalled();
    });

    it('bubbleText should be null if isAddAction is true', () => {
     component.isAddAction = true;
     expect(component.bubbleText).toBeNull();
   });

     it('bubbleWeightText should be null if isAddAction is true', () => {
      component.isAddAction = true;
      expect(component.bubbleWeightText).toBeNull();
    });
  });

  describe('Set Bubble', () => {
    beforeEach(() => {
      component.isAddAction = false;
      component.isReadOnly = false;
    });

    describe('onSetClicked Transitions', () => {
      it('PENDING -> COMPLETED', () => {
        const pendingSet = createMockSet({ status: 'PENDING', expectedReps: 10, weight: 100 });
        initializeComponentSet(pendingSet);
        const spy = vi.spyOn(component.setClicked, 'emit');

        component.onSetClicked();

        const expectedState: Partial<SessionSetViewModel> = {
          status: 'COMPLETED',
          actualReps: 10,
          weight: 100,
        };
        expect(component['optimisticSet']()).toMatchObject(expectedState);
        expect(spy).toHaveBeenCalledWith(expect.objectContaining(expectedState));
      });

      it('SKIPPED -> COMPLETED', () => {
        const skippedSet = createMockSet({ status: 'SKIPPED', expectedReps: 12, weight: 50 });
        initializeComponentSet(skippedSet);
        const spy = vi.spyOn(component.setClicked, 'emit');

        component.onSetClicked();

        const expectedState: Partial<SessionSetViewModel> = {
          status: 'COMPLETED',
          actualReps: 12,
          weight: 50,
        };
        expect(component['optimisticSet']()).toMatchObject(expectedState);
        expect(spy).toHaveBeenCalledWith(expect.objectContaining(expectedState));
      });

      it('COMPLETED -> FAILED (reps decrease below expected)', () => {
        const completedSet = createMockSet({ status: 'COMPLETED', expectedReps: 10, actualReps: 10, weight: 100 });
        initializeComponentSet(completedSet);
        const spy = vi.spyOn(component.setClicked, 'emit');

        component.onSetClicked(); // 10 -> 9 (FAILED)
        const expectedState1: Partial<SessionSetViewModel> = {
          status: 'FAILED',
          actualReps: 9,
        };
        expect(component['optimisticSet']()).toMatchObject(expectedState1);
        expect(spy).toHaveBeenCalledWith(expect.objectContaining(expectedState1));
      });

      it('COMPLETED -> COMPLETED (reps decrease but >= expected)', () => {
        const completedSet = createMockSet({ status: 'COMPLETED', expectedReps: 5, actualReps: 10, weight: 100 });
        initializeComponentSet(completedSet);
        const spy = vi.spyOn(component.setClicked, 'emit');

        component.onSetClicked(); // 10 -> 9 (COMPLETED)
        expect(component['optimisticSet']()).toMatchObject({ status: 'COMPLETED', actualReps: 9 });
        expect(spy).toHaveBeenCalledWith(expect.objectContaining({ status: 'COMPLETED', actualReps: 9 }));

        component.onSetClicked(); // 9 -> 8 (COMPLETED)
        expect(component['optimisticSet']()).toMatchObject({ status: 'COMPLETED', actualReps: 8 });

        for (let i = 0; i < 3; i++) component.onSetClicked(); // 8->7, 7->6, 6->5 (COMPLETED)
        expect(component['optimisticSet']()).toMatchObject({ status: 'COMPLETED', actualReps: 5 });

        component.onSetClicked(); // 5 -> 4 (FAILED)
        expect(component['optimisticSet']()).toMatchObject({ status: 'FAILED', actualReps: 4 });
      });


      it('FAILED -> FAILED (reps decrease but > 0)', () => {
        const failedSet = createMockSet({ status: 'FAILED', expectedReps: 10, actualReps: 3, weight: 100 });
        initializeComponentSet(failedSet);
        const spy = vi.spyOn(component.setClicked, 'emit');

        component.onSetClicked(); // 3 -> 2 (FAILED)
        const expectedState: Partial<SessionSetViewModel> = {
          status: 'FAILED',
          actualReps: 2,
        };
        expect(component['optimisticSet']()).toMatchObject(expectedState);
        expect(spy).toHaveBeenCalledWith(expect.objectContaining(expectedState));
      });

      it('FAILED (0 reps) -> PENDING', () => {
        const failedSet = createMockSet({ status: 'FAILED', expectedReps: 10, actualReps: 0, weight: 100 });
        initializeComponentSet(failedSet);
        const spy = vi.spyOn(component.setClicked, 'emit');

        component.onSetClicked(); // 0 -> PENDING
        const expectedState: Partial<SessionSetViewModel> = {
          status: 'PENDING',
          actualReps: undefined,
        };
        expect(component['optimisticSet']()).toMatchObject(expectedState);
        expect(spy).toHaveBeenCalledWith(expect.objectContaining(expectedState));
      });

      it('should not do anything if read-only', () => {
        component.isReadOnly = true;
        const pendingSet = createMockSet({ status: 'PENDING' });
        initializeComponentSet(pendingSet);
        const clickSpy = vi.spyOn(component.setClicked, 'emit');

        component.onSetClicked();

        expect(component['optimisticSet']().status).toBe('PENDING');
        expect(clickSpy).not.toHaveBeenCalled();
      });
    });

    describe('onSetLongPressed', () => {
      it('should emit setLongPressed with the original set data (@Input set)', () => {
        const originalSet = createMockSet({ id: 'longPressSet' });
        initializeComponentSet(originalSet);
        const spy = vi.spyOn(component.setLongPressed, 'emit');

        component.onSetLongPressed();

        expect(spy).toHaveBeenCalledWith(originalSet);
      });

      it('should not emit setLongPressed if read-only', () => {
        component.isReadOnly = true;
        initializeComponentSet(createMockSet());
        const spy = vi.spyOn(component.setLongPressed, 'emit');

        component.onSetLongPressed();
        expect(spy).not.toHaveBeenCalled();
      });
    });

    describe('Getters', () => {
      it('displayedSet should return optimisticSet', () => {
        const currentSet = createMockSet({ id: 'displayed' });
        initializeComponentSet(currentSet);
        expect(component.set).toEqual(currentSet);
      });

      it('bubbleText: PENDING', () => {
        initializeComponentSet(createMockSet({ status: 'PENDING', expectedReps: 12 }));
        expect(component.bubbleText).toBe('12');
      });

      it('bubbleText: SKIPPED', () => {
        initializeComponentSet(createMockSet({ status: 'SKIPPED', expectedReps: 8 }));
        expect(component.bubbleText).toBe('8');
      });

      it('bubbleText: COMPLETED (with actualReps)', () => {
        initializeComponentSet(createMockSet({ status: 'COMPLETED', expectedReps: 10, actualReps: 9 }));
        expect(component.bubbleText).toBe('9');
      });

      it('bubbleText: COMPLETED (no actualReps, fallback to expectedReps)', () => {
        initializeComponentSet(createMockSet({ status: 'COMPLETED', expectedReps: 10, actualReps: undefined }));
        expect(component.bubbleText).toBe('10');
      });

      it('bubbleText: FAILED (with actualReps)', () => {
        initializeComponentSet(createMockSet({ status: 'FAILED', expectedReps: 10, actualReps: 1 }));
        expect(component.bubbleText).toBe('1');
      });

      it('bubbleText: FAILED (no actualReps, fallback to 0)', () => {
        initializeComponentSet(createMockSet({ status: 'FAILED', expectedReps: 10, actualReps: undefined }));
        expect(component.bubbleText).toBe('0');
      });

      it('bubbleWeightText: should return weight as string', () => {
        initializeComponentSet(createMockSet({ weight: 75 }));
        expect(component.bubbleWeightText).toBe('75');
      });

      it('bubbleWeightText: should return null if weight is undefined', () => {
        initializeComponentSet(createMockSet({ weight: undefined }));
        expect(component.bubbleWeightText).toBeNull();
      });

       it('bubbleWeightText: should return weight as string even if 0', () => {
        initializeComponentSet(createMockSet({ weight: 0 }));
        expect(component.bubbleWeightText).toBe('0');
      });

      it('bubbleWeightText: should return null if displayedSet is null (via isAddAction)', () => {
        component.isAddAction = true;
        expect(component.bubbleWeightText).toBeNull();
      });
    });
  });
});
