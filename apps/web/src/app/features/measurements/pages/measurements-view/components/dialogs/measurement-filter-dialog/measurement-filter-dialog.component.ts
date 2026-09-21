import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MeasurementFiltersViewModel } from '@features/measurements/models/measurements.viewmodel';
import { DateRangeFieldComponent } from '@shared/ui/components/date-range-field/date-range-field.component';
import { DateRangeValue } from '@shared/utils/dates/date-range-presets';

@Component({
  selector: 'txg-measurement-filter-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, DateRangeFieldComponent],
  templateUrl: './measurement-filter-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MeasurementFilterDialogComponent implements OnInit {
  dialogRef = inject<MatDialogRef<MeasurementFilterDialogComponent>>(MatDialogRef);
  data = inject<{ filters: MeasurementFiltersViewModel }>(MAT_DIALOG_DATA);

  dateRange!: DateRangeValue;
  dateRangeValid = true;

  ngOnInit(): void {
    this.dateRange = this.data.filters.dateRange;
  }

  onDateRangeChanged(value: DateRangeValue): void {
    this.dateRange = value;
  }

  onDateRangeValidityChanged(valid: boolean): void {
    this.dateRangeValid = valid;
  }

  onFiltersApplied(): void {
    if (!this.dateRangeValid) {
      return;
    }

    this.dialogRef.close({ dateRange: this.dateRange } satisfies MeasurementFiltersViewModel);
  }

  onCancelled(): void {
    this.dialogRef.close();
  }
}
