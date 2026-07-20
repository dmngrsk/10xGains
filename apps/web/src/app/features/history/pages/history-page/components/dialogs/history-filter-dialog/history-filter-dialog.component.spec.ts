import { TestBed } from '@angular/core/testing';
import { MatDatepicker } from '@angular/material/datepicker';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HistoryFiltersViewModel } from '@features/history/models/history-page.viewmodel';
import { DateRangeValue } from '@shared/utils/dates/date-range-presets';
import { HistoryFilterDialogComponent, HistoryFilterDialogData } from './history-filter-dialog.component';

const AVAILABLE_PLANS = [
  { id: 'plan-1', name: 'Starting Strength' },
  { id: 'plan-2', name: 'Texas Method' },
];

const DATE_RANGE_1M: DateRangeValue = { preset: '1M', dateFrom: '2026-06-13T00:00:00.000Z', dateTo: null };

const baseFilters: HistoryFiltersViewModel = {
  selectedPlanId: 'plan-1',
  dateRange: DATE_RANGE_1M,
  pageSize: 10,
  availablePlans: AVAILABLE_PLANS,
  pageSizeOptions: [5, 10, 25, 100],
};

const listData: HistoryFilterDialogData = { 
  mode: 'list', 
  filters: baseFilters
};

const calendarData: HistoryFilterDialogData = {
  mode: 'calendar',
  selectedPlanId: 'plan-1',
  month: '2026-05',
  availablePlans: AVAILABLE_PLANS,
};

describe('HistoryFilterDialogComponent', () => {
  let close: ReturnType<typeof vi.fn>;
  let fixture: ReturnType<typeof TestBed.createComponent<HistoryFilterDialogComponent>>;

  const createComponent = (data: HistoryFilterDialogData = listData) => {
    close = vi.fn();

    TestBed.configureTestingModule({
      imports: [HistoryFilterDialogComponent, NoopAnimationsModule],
      providers: [
        { provide: MatDialogRef, useValue: { close } },
        { provide: MAT_DIALOG_DATA, useValue: data },
      ],
    });

    fixture = TestBed.createComponent(HistoryFilterDialogComponent);
    fixture.detectChanges();
    return fixture.componentInstance;
  };

  beforeEach(() => TestBed.resetTestingModule());

  describe('in list mode', () => {
    it('should emit the plan, page size and date range on apply', () => {
      const component = createComponent();

      component.onFiltersApplied();

      expect(close).toHaveBeenCalledWith({
        selectedPlanId: 'plan-1',
        dateRange: DATE_RANGE_1M,
        pageSize: 10,
        pageSizeOptions: [5, 10, 25, 100],
        availablePlans: AVAILABLE_PLANS,
      });
    });

    it('should emit the latest date range reported by the field', () => {
      const component = createComponent();
      const edited: DateRangeValue = { preset: null, dateFrom: '2026-03-01T00:00:00.000Z', dateTo: '2026-04-01T23:59:59.999Z' };

      component.onDateRangeChanged(edited);
      component.onFiltersApplied();

      expect(close).toHaveBeenCalledWith(expect.objectContaining({ dateRange: edited }));
    });

    it('should not apply while the date range is invalid', () => {
      const component = createComponent();

      component.onDateRangeValidityChanged(false);
      component.onFiltersApplied();

      expect(close).not.toHaveBeenCalled();
    });

    it('should close without a result when cancelled', () => {
      const component = createComponent();

      component.onCancelled();

      expect(close).toHaveBeenCalledWith();
    });
  });

  describe('in calendar mode', () => {
    it('should render the plan and month fields without the date range and page size fields', () => {
      createComponent(calendarData);

      expect(fixture.nativeElement.querySelector('mat-select')).not.toBeNull();
      expect(fixture.nativeElement.querySelector('[data-cy="history-filter-dialog-month-input"]')).not.toBeNull();
      expect(fixture.nativeElement.querySelector('txg-date-range-field')).toBeNull();
      expect(fixture.nativeElement.querySelectorAll('mat-select')).toHaveLength(1); // no page size select
    });

    it('should emit the plan and the picked month on apply', () => {
      const component = createComponent(calendarData);
      const picker = { close: vi.fn() } as unknown as MatDatepicker<Date>;

      vi.useFakeTimers();
      try {
        component.onMonthSelected(new Date(2026, 7, 1), picker);
        vi.runOnlyPendingTimers();
      } finally {
        vi.useRealTimers();
      }
      component.onFiltersApplied();

      expect(picker.close).toHaveBeenCalledOnce();
      expect(close).toHaveBeenCalledWith({ selectedPlanId: 'plan-1', month: '2026-08' });
    });

    it('should emit the seeded month when it is left untouched', () => {
      const component = createComponent(calendarData);

      component.onFiltersApplied();

      expect(close).toHaveBeenCalledWith({ selectedPlanId: 'plan-1', month: '2026-05' });
    });
  });
});
