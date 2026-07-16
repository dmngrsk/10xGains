import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { ProgressFilterPlan, ProgressFiltersViewModel } from '@features/progress/models/progress-page.viewmodel';
import { DateRangeFieldComponent } from '@shared/ui/components/date-range-field/date-range-field.component';
import { DateRangeValue } from '@shared/utils/dates/date-range-presets';

export const ALL_PLANS = 'ALL_PLANS';

@Component({
  selector: 'txg-progress-filter-dialog',
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
  templateUrl: './progress-filter-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProgressFilterDialogComponent implements OnInit {
  dialogRef = inject<MatDialogRef<ProgressFilterDialogComponent>>(MatDialogRef);
  data = inject<{ filters: ProgressFiltersViewModel }>(MAT_DIALOG_DATA);

  private readonly fb = inject(FormBuilder);

  filterForm!: FormGroup;

  dateRange!: DateRangeValue;
  dateRangeValid = true;

  readonly allPlans = ALL_PLANS;

  get availablePlans(): ProgressFilterPlan[] {
    return this.data.filters.availablePlans || [];
  }

  ngOnInit(): void {
    this.filterForm = this.fb.group({
      selectedPlanId: [this.data.filters.selectedPlanId ?? ALL_PLANS],
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
    const filtersToEmit: ProgressFiltersViewModel = {
      selectedPlanId: formValue.selectedPlanId === ALL_PLANS ? null : formValue.selectedPlanId,
      dateRange: this.dateRange,
      availablePlans: this.data.filters.availablePlans,
    };

    this.dialogRef.close(filtersToEmit);
  }

  onCancelled(): void {
    this.dialogRef.close();
  }
}
