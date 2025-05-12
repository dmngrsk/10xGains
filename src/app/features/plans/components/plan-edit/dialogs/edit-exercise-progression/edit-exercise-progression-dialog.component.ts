import { ChangeDetectionStrategy, Component, Inject, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { integerValidator } from '@shared/utils/forms/validators/integer.validator';
import { numericValidator } from '@shared/utils/forms/validators/numeric.validator';
import { VALIDATION_MESSAGES } from '@shared/ui/messages/validation';
import type { TrainingPlanExerciseProgressionDto } from '@shared/api/api.types';

export type EditExerciseProgressionDialogValue = Pick<TrainingPlanExerciseProgressionDto, 'weight_increment' | 'deload_strategy' | 'reference_set_index' | 'failure_count_for_deload' | 'deload_percentage'>;
export type EditExerciseProgressionDialogData = Partial<EditExerciseProgressionDialogValue>;
export type EditExerciseProgressionDialogCloseResult =
  | { save: true; value: EditExerciseProgressionDialogValue }
  | undefined;

export const DELOAD_STRATEGIES = [
  { value: 'PROPORTIONAL', viewValue: 'Proportional' },
  { value: 'REFERENCE_SET', viewValue: 'Reference Set' }
];

@Component({
  selector: 'txg-edit-exercise-progression-dialog',
  templateUrl: './edit-exercise-progression-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatSelectModule,
  ],
})
export class EditExerciseProgressionDialogComponent implements OnInit, OnDestroy {
  progressionForm: FormGroup;
  deloadStrategies = DELOAD_STRATEGIES;
  private destroy$ = new Subject<void>();

  get validationMessages() {
    return VALIDATION_MESSAGES;
  }

  constructor(
    private readonly fb: FormBuilder,
    private readonly dialogRef: MatDialogRef<EditExerciseProgressionDialogComponent, EditExerciseProgressionDialogCloseResult>,
    @Inject(MAT_DIALOG_DATA) public readonly data: EditExerciseProgressionDialogData,
  ) {
    this.progressionForm = this.fb.group({
      weightIncrement: [this.data?.weight_increment ?? null, [Validators.required, Validators.min(0), numericValidator()]],
      deloadStrategy: [this.data?.deload_strategy ?? 'PROPORTIONAL', [Validators.required]],
      referenceSetIndex: [this.data?.reference_set_index ?? null],
      failureCountForDeload: [this.data?.failure_count_for_deload ?? 3, [Validators.required, Validators.min(1), integerValidator()]],
      deloadPercentage: [this.data?.deload_percentage ?? 10, [Validators.required, Validators.min(0), Validators.max(100), numericValidator()]],
    });
  }

  ngOnInit(): void {
    this.updateReferenceSetIndexValidators(this.progressionForm.get('deloadStrategy')?.value);

    this.progressionForm.get('deloadStrategy')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(strategy => {
        this.updateReferenceSetIndexValidators(strategy);
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private updateReferenceSetIndexValidators(strategy: string | null): void {
    const referenceSetIndexControl = this.progressionForm.get('referenceSetIndex');
    if (!referenceSetIndexControl) return;

    if (strategy === 'REFERENCE_SET') {
      referenceSetIndexControl.setValidators([Validators.required, Validators.min(1), integerValidator()]);
    } else {
      referenceSetIndexControl.setValidators(null);
      referenceSetIndexControl.setValue(null);
    }
    referenceSetIndexControl.updateValueAndValidity();
  }

  get showReferenceSetIndexField(): boolean {
    return this.progressionForm.get('deloadStrategy')?.value === 'REFERENCE_SET';
  }

  onSave(): void {
    if (this.progressionForm.valid) {
      const formValue = this.progressionForm.value;
      const command: EditExerciseProgressionDialogValue = {
        weight_increment: parseFloat(formValue.weightIncrement),
        deload_strategy: formValue.deloadStrategy,
        reference_set_index: formValue.deloadStrategy === 'REFERENCE_SET' ? parseInt(formValue.referenceSetIndex, 10) : null,
        failure_count_for_deload: parseInt(formValue.failureCountForDeload, 10),
        deload_percentage: parseFloat(formValue.deloadPercentage),
      };
      this.dialogRef.close({ save: true, value: command });
    } else {
      this.progressionForm.markAllAsTouched();
    }
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}
