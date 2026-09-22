import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProgressFiltersViewModel } from '@features/progress/models/progress-page.viewmodel';
import { ALL_PLANS, ProgressFilterDialogComponent } from './progress-filter-dialog.component';

const AVAILABLE_PLANS = [
  { id: 'plan-1', name: 'Starting Strength' },
  { id: 'plan-2', name: 'Texas Method' },
];

const DATE_RANGE_3M = { preset: '3M' as const, dateFrom: '2026-04-13T00:00:00.000Z', dateTo: null };
const DATE_RANGE_6M = { preset: '6M' as const, dateFrom: '2026-01-13T00:00:00.000Z', dateTo: null };

describe('ProgressFilterDialogComponent', () => {
  let close: ReturnType<typeof vi.fn>;

  const createComponent = (filters: ProgressFiltersViewModel) => {
    close = vi.fn();

    TestBed.configureTestingModule({
      imports: [ProgressFilterDialogComponent, NoopAnimationsModule],
      providers: [
        { provide: MatDialogRef, useValue: { close } },
        { provide: MAT_DIALOG_DATA, useValue: { filters } },
      ],
    });

    const fixture = TestBed.createComponent(ProgressFilterDialogComponent);
    fixture.detectChanges();
    return fixture.componentInstance;
  };

  beforeEach(() => TestBed.resetTestingModule());

  describe('when no plan filter is applied', () => {
    it('should preselect the All plans sentinel, so the select keeps a visible value', () => {
      const component = createComponent({ selectedPlanId: null, dateRange: DATE_RANGE_3M, availablePlans: AVAILABLE_PLANS });

      expect(component.filterForm.value.selectedPlanId).toBe(ALL_PLANS);
    });

    it('should map the sentinel back to null when applying', () => {
      const component = createComponent({ selectedPlanId: null, dateRange: DATE_RANGE_3M, availablePlans: AVAILABLE_PLANS });

      component.onFiltersApplied();

      expect(close).toHaveBeenCalledWith(expect.objectContaining({ selectedPlanId: null }));
    });
  });

  describe('when a plan filter is applied', () => {
    it('should preselect that plan', () => {
      const component = createComponent({ selectedPlanId: 'plan-2', dateRange: DATE_RANGE_6M, availablePlans: AVAILABLE_PLANS });

      expect(component.filterForm.value.selectedPlanId).toBe('plan-2');
    });

    it('should emit the plan id and preset unchanged', () => {
      const component = createComponent({ selectedPlanId: 'plan-2', dateRange: DATE_RANGE_6M, availablePlans: AVAILABLE_PLANS });

      component.onFiltersApplied();

      expect(close).toHaveBeenCalledWith({
        selectedPlanId: 'plan-2',
        dateRange: DATE_RANGE_6M,
        availablePlans: AVAILABLE_PLANS,
      });
    });

    it('should emit null when the user switches to All plans', () => {
      const component = createComponent({ selectedPlanId: 'plan-2', dateRange: DATE_RANGE_6M, availablePlans: AVAILABLE_PLANS });

      component.filterForm.patchValue({ selectedPlanId: ALL_PLANS });
      component.onFiltersApplied();

      expect(close).toHaveBeenCalledWith(expect.objectContaining({ selectedPlanId: null }));
    });
  });

  it('should not apply while the date range is invalid', () => {
    const component = createComponent({ selectedPlanId: null, dateRange: DATE_RANGE_3M, availablePlans: AVAILABLE_PLANS });

    component.onDateRangeValidityChanged(false);
    component.onFiltersApplied();

    expect(close).not.toHaveBeenCalled();
  });

  it('should close without a result when cancelled', () => {
    const component = createComponent({ selectedPlanId: null, dateRange: DATE_RANGE_3M, availablePlans: AVAILABLE_PLANS });

    component.onCancelled();

    expect(close).toHaveBeenCalledWith();
  });
});
