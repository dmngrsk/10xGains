import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { ProgressDateRangePreset, ProgressFilterPlan, ProgressFiltersViewModel } from '@features/progress/models/progress-page.viewmodel';
import { DATE_RANGE_PRESET_LABELS } from '@features/progress/models/progress.mapping';

export const PRESET_ORDER: ProgressDateRangePreset[] = ['3M', '6M', '1Y', 'ALL'];
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
  ],
  templateUrl: './progress-filter-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProgressFilterDialogComponent implements OnInit {
  dialogRef = inject<MatDialogRef<ProgressFilterDialogComponent>>(MatDialogRef);
  data = inject<{ filters: ProgressFiltersViewModel }>(MAT_DIALOG_DATA);

  private readonly fb = inject(FormBuilder);

  filterForm!: FormGroup;

  readonly presetOptions = PRESET_ORDER.map(preset => ({ value: preset, label: DATE_RANGE_PRESET_LABELS[preset] }));
  readonly allPlans = ALL_PLANS;

  get availablePlans(): ProgressFilterPlan[] {
    return this.data.filters.availablePlans || [];
  }

  ngOnInit(): void {
    this.filterForm = this.fb.group({
      selectedPlanId: [this.data.filters.selectedPlanId ?? ALL_PLANS],
      dateRangePreset: [this.data.filters.dateRangePreset],
    });
  }

  onFiltersApplied(): void {
    if (this.filterForm.invalid) {
      return;
    }

    const formValue = this.filterForm.value;
    const filtersToEmit: ProgressFiltersViewModel = {
      selectedPlanId: formValue.selectedPlanId === ALL_PLANS ? null : formValue.selectedPlanId,
      dateRangePreset: formValue.dateRangePreset,
      availablePlans: this.data.filters.availablePlans,
    };

    this.dialogRef.close(filtersToEmit);
  }

  onCancelled(): void {
    this.dialogRef.close();
  }
}
