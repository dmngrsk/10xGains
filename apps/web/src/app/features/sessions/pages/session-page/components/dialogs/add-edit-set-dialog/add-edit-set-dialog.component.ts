import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Inject } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { CreateSessionSetCommand, UpdateSessionSetCommand } from '@shared/api/api.types';
import { VALIDATION_MESSAGES } from '@shared/ui/messages/validation';
import { integerValidator } from '@shared/utils/forms/validators/integer.validator';
import { numericValidator } from '@shared/utils/forms/validators/numeric.validator';
import { SessionSetViewModel } from '../../../../../models/session-page.viewmodel';

export interface AddEditSetDialogData {
  mode: 'add' | 'edit';
  sessionId?: string;
  planExerciseId?: string;
  setIndexForNewSet?: number;
  setToEditDetails?: SessionSetViewModel;
  lastSetForPreFill?: SessionSetViewModel;
  maxPlannedSetIndex?: number;
}

export interface DeleteSetResult {
  action: 'delete';
  setId: string;
}

export type AddEditSetDialogCloseResult = CreateSessionSetCommand | UpdateSessionSetCommand | DeleteSetResult | undefined;

@Component({
  selector: 'txg-add-edit-set-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatSelectModule
  ],
  templateUrl: './add-edit-set-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddEditSetDialogComponent {
  setForm: FormGroup;

  get titleText(): string {
    if (this.data.mode === 'edit' && this.data.setToEditDetails) {
      return 'Edit Set Details';
    } else if (this.data.mode === 'add') {
      return 'Add New Set';
    } else {
      console.error('AddEditSetDialog: Invalid mode or missing data for title setup', this.data);
      return 'Set Details';
    }
  }

  get saveButtonText(): string {
    if (this.data.mode === 'add') {
      return 'Add Set';
    } else {
      return 'Save';
    }
  }

  get isSetDeletable(): boolean {
    if (this.data.mode !== 'edit' || !this.data.setToEditDetails || this.data.maxPlannedSetIndex === undefined) {
      return false;
    }
    return this.data.setToEditDetails.order > this.data.maxPlannedSetIndex;
  }

  get validationMessages() {
    return VALIDATION_MESSAGES;
  }

  constructor(
    public dialogRef: MatDialogRef<AddEditSetDialogComponent, AddEditSetDialogCloseResult>,
    public fb: FormBuilder,
    @Inject(MAT_DIALOG_DATA) public data: AddEditSetDialogData
  ) {
    let initialReps: string = '';
    let initialWeight: string = '';

    if (this.data.mode === 'edit' && this.data.setToEditDetails) {
      const setToEdit = this.data.setToEditDetails;
      initialReps = (setToEdit.expectedReps ?? setToEdit.actualReps ?? '').toString();
      initialWeight = (setToEdit.weight ?? '').toString();
    } else if (this.data.mode === 'add') {
      if (this.data.lastSetForPreFill) {
        initialReps = (this.data.lastSetForPreFill.expectedReps ?? this.data.lastSetForPreFill.actualReps ?? '').toString();
        initialWeight = (this.data.lastSetForPreFill.weight ?? '').toString();
      }
    }

    this.setForm = this.fb.group({
      reps: [initialReps, [Validators.required, Validators.min(0), integerValidator()]],
      weight: [initialWeight, [Validators.required, Validators.min(0), numericValidator()]],
    });
  }

  onSave(): void {
    if (this.setForm.invalid) {
      this.setForm.markAllAsTouched();
      return;
    }

    const formValue = this.setForm.value;

    if (this.data.mode === 'edit' && this.data.setToEditDetails) {
      const command: UpdateSessionSetCommand = {
        expected_reps: Number(formValue.reps),
        actual_reps: null,
        actual_weight: Number(formValue.weight),
        status: 'PENDING',
      };
      this.dialogRef.close(command);
    } else if (
      this.data.mode === 'add' &&
      this.data.sessionId &&
      this.data.planExerciseId &&
      this.data.setIndexForNewSet !== undefined
    ) {
      const command: CreateSessionSetCommand = {
        session_id: this.data.sessionId,
        plan_exercise_id: this.data.planExerciseId,
        set_index: this.data.setIndexForNewSet,
        expected_reps: Number(formValue.reps),
        actual_reps: null,
        actual_weight: Number(formValue.weight),
        status: 'PENDING',
      };
      this.dialogRef.close(command);
    } else {
      console.error('AddEditSetDialog: Invalid state for save operation', this.data);
      this.dialogRef.close();
    }
  }

  onDelete(): void {
    if (!this.data.setToEditDetails || !this.data.setToEditDetails.id) {
      console.error('AddEditSetDialog: Cannot delete, set details or ID missing.');
      return;
    }
    const deleteResult: DeleteSetResult = {
      action: 'delete',
      setId: this.data.setToEditDetails.id
    };
    this.dialogRef.close(deleteResult);
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}
