import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PlanEditPageComponent } from './plan-edit-page.component';
import { PlanEditPageFacade } from './plan-edit-page.facade';
import { initialPlanEditPageViewModel } from '../../models/plan-edit-page.viewmodel';

/** Longer than the stepper's debounce, so a tap is actually sent rather than left waiting. */
const PAST_DEBOUNCE_MS = 600;

const step = (setId: string, weight: number) => ({ setId, exerciseId: 'exercise-1', dayId: 'day-1', weight });

describe('PlanEditPageComponent', () => {
  let updatePlanExerciseSetMock: ReturnType<typeof vi.fn>;
  let reloadMock: ReturnType<typeof vi.fn>;
  let snackBarOpenMock: ReturnType<typeof vi.fn>;

  const createComponent = () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: ActivatedRoute, useValue: { paramMap: of({ get: () => 'plan-1' }) } },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: MatDialog, useValue: { open: vi.fn() } },
        { provide: MatSnackBar, useValue: { open: snackBarOpenMock } },
        {
          provide: PlanEditPageFacade,
          useValue: {
            viewModel: signal(initialPlanEditPageViewModel).asReadonly(),
            loadPlanData: vi.fn(),
            reload: reloadMock,
            updatePlanExerciseSet: updatePlanExerciseSetMock,
            getAvailableExercises: () => [],
          }
        },
      ]
    });

    // Instantiated in an injection context rather than rendered: the pipeline under test is wired
    // in ngOnInit and driven through onSetWeightStepped, so the template plays no part in it.
    const component = TestBed.runInInjectionContext(() => new PlanEditPageComponent());
    component.ngOnInit();
    return component;
  };

  beforeEach(() => {
    vi.useFakeTimers();
    updatePlanExerciseSetMock = vi.fn().mockReturnValue(of({ data: null, error: null }));
    reloadMock = vi.fn();
    snackBarOpenMock = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('the weight stepper', () => {
    it('should send one request carrying the value the user settled on', () => {
      const component = createComponent();

      component.onSetWeightStepped(step('set-1', 60));
      component.onSetWeightStepped(step('set-1', 62.5));
      component.onSetWeightStepped(step('set-1', 65));
      vi.advanceTimersByTime(PAST_DEBOUNCE_MS);

      expect(updatePlanExerciseSetMock).toHaveBeenCalledTimes(1);
      expect(updatePlanExerciseSetMock).toHaveBeenCalledWith('day-1', 'exercise-1', 'set-1', { expected_weight: 65 });

      component.ngOnDestroy();
    });

    it('should not make two different sets wait on each other', () => {
      const component = createComponent();

      component.onSetWeightStepped(step('set-1', 60));
      component.onSetWeightStepped(step('set-2', 80));
      vi.advanceTimersByTime(PAST_DEBOUNCE_MS);

      expect(updatePlanExerciseSetMock).toHaveBeenCalledTimes(2);

      component.ngOnDestroy();
    });

    it('should keep saving after a request throws, rather than dying with it', () => {
      // The regression: `catchAndDisplayError` completes the stream it is applied to, so applying it
      // to the stepper's own pipeline made one error silence every later tap.
      const component = createComponent();
      updatePlanExerciseSetMock.mockReturnValueOnce(throwError(() => new Error('Offline')));

      component.onSetWeightStepped(step('set-1', 60));
      vi.advanceTimersByTime(PAST_DEBOUNCE_MS);

      expect(updatePlanExerciseSetMock).toHaveBeenCalledTimes(1);
      expect(snackBarOpenMock).toHaveBeenCalledWith(
        expect.stringContaining('Failed to update weight'), 'Close', expect.anything());

      component.onSetWeightStepped(step('set-1', 62.5));
      vi.advanceTimersByTime(PAST_DEBOUNCE_MS);

      expect(updatePlanExerciseSetMock).toHaveBeenCalledTimes(2);
      expect(updatePlanExerciseSetMock).toHaveBeenLastCalledWith('day-1', 'exercise-1', 'set-1', { expected_weight: 62.5 });

      component.ngOnDestroy();
    });

    it('should keep saving a different set after another set throws', () => {
      const component = createComponent();
      updatePlanExerciseSetMock.mockReturnValueOnce(throwError(() => new Error('Offline')));

      component.onSetWeightStepped(step('set-1', 60));
      vi.advanceTimersByTime(PAST_DEBOUNCE_MS);
      component.onSetWeightStepped(step('set-2', 80));
      vi.advanceTimersByTime(PAST_DEBOUNCE_MS);

      expect(updatePlanExerciseSetMock).toHaveBeenLastCalledWith('day-1', 'exercise-1', 'set-2', { expected_weight: 80 });

      component.ngOnDestroy();
    });

    it('should reload the plan when a write comes back with an error envelope', () => {
      // A failed write leaves the row showing a weight that was never saved; reloading puts it back.
      const component = createComponent();
      updatePlanExerciseSetMock.mockReturnValueOnce(of({ data: null, error: 'Set no longer exists.' }));

      component.onSetWeightStepped(step('set-1', 60));
      vi.advanceTimersByTime(PAST_DEBOUNCE_MS);

      expect(snackBarOpenMock).toHaveBeenCalledWith('Set no longer exists.', 'Close', expect.anything());
      expect(reloadMock).toHaveBeenCalledTimes(1);

      component.ngOnDestroy();
    });
  });
});
