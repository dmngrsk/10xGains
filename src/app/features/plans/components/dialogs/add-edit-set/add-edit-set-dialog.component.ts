import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { PlanExerciseSetDto } from '@shared/api/api.types';
import { VALIDATION_MESSAGES } from '@shared/ui/messages/validation';
import { integerValidator } from '@shared/utils/forms/validators/integer.validator';
import { numericValidator } from '@shared/utils/forms/validators/numeric.validator';

export type AddEditSetDialogValue = Pick<PlanExerciseSetDto, 'expected_reps' | 'expected_weight'>;
export type AddEditSetDialogData = Partial<AddEditSetDialogValue> & { isEditMode?: boolean; }
export type AddEditSetDialogCloseResult =
  | { save: true; value: AddEditSetDialogValue }
  | { delete: true }
  | undefined;

@Component({
  selector: 'txg-add-edit-set-dialog',
  templateUrl: './add-edit-set-dialog.component.html',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    FormsModule,
    ReactiveFormsModule
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddEditSetDialogComponent {
  setForm: FormGroup;
  get validationMessages() {
    return VALIDATION_MESSAGES;
  }

  constructor(
    private fb: FormBuilder,
    public dialogRef: MatDialogRef<AddEditSetDialogComponent, AddEditSetDialogCloseResult>,
    @Inject(MAT_DIALOG_DATA) public data: AddEditSetDialogData
  ) {
    this.setForm = this.fb.group({
      reps: [data?.expected_reps ?? null, [
        Validators.required,
        Validators.min(1),
        integerValidator()
      ]],
      weight: [data?.expected_weight ?? null, [
        Validators.required,
        Validators.min(0),
        numericValidator()
      ]],
    });
  }

  onSave(): void {
    if (this.setForm.invalid) {
      this.setForm.markAllAsTouched();
      return;
    }
    this.dialogRef.close({
      save: true,
      value: {
        expected_reps: Number(this.setForm.value.reps),
        expected_weight: Number(this.setForm.value.weight)
      }
    });
  }

  onDeleteSet(): void {
    this.dialogRef.close({ delete: true });
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}
