import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { DateAdapter, MAT_DATE_FORMATS, MatNativeDateModule } from '@angular/material/core';
import { MatDatepicker, MatDatepickerModule } from '@angular/material/datepicker';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { format, parse } from 'date-fns';
import { HistoryFiltersViewModel, HistoryFilterPlan } from '@features/history/models/history-page.viewmodel';
import { DateRangeFieldComponent } from '@shared/ui/components/date-range-field/date-range-field.component';
import { DateRangeValue } from '@shared/utils/dates/date-range-presets';
import { MondayFirstDateAdapter } from '@shared/utils/dates/monday-first-date-adapter';

export interface HistoryListFilterDialogData {
  mode: 'list';
  filters: HistoryFiltersViewModel;
}

export interface HistoryCalendarFilterDialogData {
  mode: 'calendar';
  selectedPlanId: string;
  month: string; // 'yyyy-MM'
  availablePlans: HistoryFilterPlan[];
}

export type HistoryFilterDialogData = HistoryListFilterDialogData | HistoryCalendarFilterDialogData;

export interface HistoryCalendarFilterResult {
  selectedPlanId: string;
  month: string; // 'yyyy-MM'
}

export type HistoryFilterDialogResult = HistoryFiltersViewModel | HistoryCalendarFilterResult;

const MONTH_PICKER_FORMATS = {
  parse: { dateInput: { year: 'numeric', month: 'numeric' } },
  display: {
    dateInput: { year: 'numeric', month: 'long' },
    monthYearLabel: { year: 'numeric', month: 'short' },
    dateA11yLabel: { year: 'numeric', month: 'long' },
    monthYearA11yLabel: { year: 'numeric', month: 'long' },
  },
};

@Component({
  selector: 'txg-history-filter-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatDatepickerModule,
    MatNativeDateModule,
    DateRangeFieldComponent,
  ],
  providers: [
    { provide: DateAdapter, useClass: MondayFirstDateAdapter },
    { provide: MAT_DATE_FORMATS, useValue: MONTH_PICKER_FORMATS },
  ],
  templateUrl: './history-filter-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HistoryFilterDialogComponent implements OnInit {
  dialogRef = inject<MatDialogRef<HistoryFilterDialogComponent, HistoryFilterDialogResult>>(MatDialogRef);
  data = inject<HistoryFilterDialogData>(MAT_DIALOG_DATA);

  private readonly fb = inject(FormBuilder);

  filterForm!: FormGroup;

  dateRange!: DateRangeValue;
  dateRangeValid = true;

  get availablePlans(): HistoryFilterPlan[] {
    return (this.data.mode === 'calendar' ? this.data.availablePlans : this.data.filters.availablePlans) || [];
  }

  get pageSizeOptions(): number[] {
    return this.data.mode === 'list' ? (this.data.filters.pageSizeOptions || []) : [];
  }

  ngOnInit(): void {
    if (this.data.mode === 'calendar') {
      this.filterForm = this.fb.group({
        selectedPlanId: [this.data.selectedPlanId],
        month: [parse(this.data.month, 'yyyy-MM', new Date())],
      });
    }

    if (this.data.mode === 'list') {
      this.filterForm = this.fb.group({
        selectedPlanId: [this.data.filters.selectedPlanId],
        pageSize: [this.data.filters.pageSize],
      });
      this.dateRange = this.data.filters.dateRange;
    }
  }

  onDateRangeChanged(value: DateRangeValue): void {
    this.dateRange = value;
  }

  onDateRangeValidityChanged(valid: boolean): void {
    this.dateRangeValid = valid;
  }

  onMonthSelected(month: Date, picker: MatDatepicker<Date>): void {
    this.filterForm.get('month')!.setValue(month);
    // Close on the next tick, not synchronously. Selecting a month emits monthSelected while the
    // datepicker is still transitioning to its day view; a synchronous close() races that
    // transition and is occasionally swallowed, leaving the picker open over the dialog and
    // blocking the Apply button. Deferring lets the view settle so the close always lands.
    setTimeout(() => picker.close());
  }

  onFiltersApplied(): void {
    if (this.filterForm.invalid || !this.dateRangeValid) {
      return;
    }

    const formValue = this.filterForm.value;

    if (this.data.mode === 'calendar') {
      const result: HistoryCalendarFilterResult = {
        selectedPlanId: formValue.selectedPlanId,
        month: format(formValue.month, 'yyyy-MM'),
      };
      this.dialogRef.close(result);
    }

    if (this.data.mode === 'list') {
      const result: HistoryFiltersViewModel = {
        selectedPlanId: formValue.selectedPlanId,
        dateRange: this.dateRange,
        pageSize: formValue.pageSize,
        pageSizeOptions: this.data.filters.pageSizeOptions,
        availablePlans: this.data.filters.availablePlans,
      };
      this.dialogRef.close(result);
    }
  }

  onCancelled(): void {
    this.dialogRef.close();
  }
}
