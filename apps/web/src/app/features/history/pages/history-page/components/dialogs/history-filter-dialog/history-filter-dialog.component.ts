import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Inject, OnDestroy, OnInit, inject } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { DateAdapter, MAT_DATE_FORMATS, MAT_NATIVE_DATE_FORMATS, MatNativeDateModule, NativeDateAdapter } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { Subject } from 'rxjs';
import { HistoryFiltersViewModel, HistoryFilterPlan } from '@features/history/models/history-page.viewmodel';
import { VALIDATION_MESSAGES } from '@shared/ui/messages/validation';
import { dateRangeValidator } from '@shared/utils/forms/validators/date-range.validator';

@Component({
  selector: 'txg-history-filter-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
  ],
  providers: [
    { provide: DateAdapter, useClass: NativeDateAdapter },
    { provide: MAT_DATE_FORMATS, useValue: MAT_NATIVE_DATE_FORMATS },
  ],
  templateUrl: './history-filter-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HistoryFilterDialogComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly destroy$ = new Subject<void>();

  filterForm!: FormGroup;

  get availablePlans(): HistoryFilterPlan[] {
    return this.data.filters.availablePlans || [];
  }

  get pageSizeOptions(): number[] {
    return this.data.filters.pageSizeOptions || [];
  }

  get validationMessages() {
    return VALIDATION_MESSAGES;
  }

  constructor(
    public dialogRef: MatDialogRef<HistoryFilterDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { filters: HistoryFiltersViewModel }
  ) { }

  ngOnInit(): void {
    this.filterForm = this.fb.group({
      selectedPlanId: [this.data.filters.selectedPlanId],
      dateFrom: [this.data.filters.dateFrom ? new Date(this.data.filters.dateFrom) : null],
      dateTo: [this.data.filters.dateTo ? new Date(this.data.filters.dateTo) : null],
      pageSize: [this.data.filters.pageSize],
    }, {
      validators: dateRangeValidator('dateFrom', 'dateTo')
    });
  }

  onFiltersApplied(): void {
    if (this.filterForm.invalid) {
      return;
    }

    const formValue = this.filterForm.value;
    const dateFrom = formValue.dateFrom ? new Date(formValue.dateFrom) : null;
    const dateTo = formValue.dateTo ? new Date(formValue.dateTo) : null;
    dateTo?.setHours(23, 59, 59, 999);

    const filtersToEmit: HistoryFiltersViewModel = {
      selectedPlanId: formValue.selectedPlanId,
      dateFrom: dateFrom?.toISOString() || null,
      dateTo: dateTo?.toISOString() || null,
      pageSize: formValue.pageSize,
      pageSizeOptions: this.data.filters.pageSizeOptions,
      availablePlans: this.data.filters.availablePlans,
    };

    this.dialogRef.close(filtersToEmit);
  }

  onCancelled(): void {
    this.dialogRef.close();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
