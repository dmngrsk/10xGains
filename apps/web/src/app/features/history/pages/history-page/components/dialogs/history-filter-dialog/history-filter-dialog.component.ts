import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { HistoryFiltersViewModel, HistoryFilterPlan } from '@features/history/models/history-page.viewmodel';
import { DateRangeFieldComponent } from '@shared/ui/components/date-range-field/date-range-field.component';
import { DateRangeValue } from '@shared/utils/dates/date-range-presets';

@Component({
  selector: 'txg-history-filter-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatSelectModule,
    MatButtonModule,
    DateRangeFieldComponent,
  ],
  templateUrl: './history-filter-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HistoryFilterDialogComponent implements OnInit {
  dialogRef = inject<MatDialogRef<HistoryFilterDialogComponent>>(MatDialogRef);
  data = inject<{
    filters: HistoryFiltersViewModel;
}>(MAT_DIALOG_DATA);

  private readonly fb = inject(FormBuilder);

  filterForm!: FormGroup;

  dateRange!: DateRangeValue;
  dateRangeValid = true;

  get availablePlans(): HistoryFilterPlan[] {
    return this.data.filters.availablePlans || [];
  }

  get pageSizeOptions(): number[] {
    return this.data.filters.pageSizeOptions || [];
  }

  ngOnInit(): void {
    this.filterForm = this.fb.group({
      selectedPlanId: [this.data.filters.selectedPlanId],
      pageSize: [this.data.filters.pageSize],
    });
    this.dateRange = this.data.filters.dateRange;
  }

  onDateRangeChanged(value: DateRangeValue): void {
    this.dateRange = value;
  }

  onDateRangeValidityChanged(valid: boolean): void {
    this.dateRangeValid = valid;
  }

  onFiltersApplied(): void {
    if (this.filterForm.invalid || !this.dateRangeValid) {
      return;
    }

    const formValue = this.filterForm.value;
    const filtersToEmit: HistoryFiltersViewModel = {
      selectedPlanId: formValue.selectedPlanId,
      dateRange: this.dateRange,
      pageSize: formValue.pageSize,
      pageSizeOptions: this.data.filters.pageSizeOptions,
      availablePlans: this.data.filters.availablePlans,
    };

    this.dialogRef.close(filtersToEmit);
  }

  onCancelled(): void {
    this.dialogRef.close();
  }
}
