import { CommonModule } from '@angular/common';
import { Component, Inject, inject, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroup, Validators, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TrainingPlanDto } from '@shared/api/api.types';
import { ConfirmationDialogComponent, ConfirmationDialogData } from '@shared/ui/dialogs/confirmation-dialog/confirmation-dialog.component';
import { VALIDATION_MESSAGES } from '@shared/ui/messages/validation';

export type AddEditPlanDialogValue = Pick<TrainingPlanDto, 'name' | 'description'>;
export type AddEditPlanDialogData = Partial<AddEditPlanDialogValue> & { isEditMode?: boolean; }
export type AddEditPlanDialogCloseResult =
  | { save: true; value: AddEditPlanDialogValue }
  | { delete: true }
  | undefined;

@Component({
  selector: 'txg-add-edit-plan-dialog',
  templateUrl: './add-edit-plan-dialog.component.html',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
  ],
})
export class AddEditPlanDialogComponent {
  planForm: FormGroup;

  private readonly matDialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);

  constructor(
    private fb: FormBuilder,
    public dialogRef: MatDialogRef<AddEditPlanDialogComponent, AddEditPlanDialogCloseResult>,
    @Inject(MAT_DIALOG_DATA) public data: AddEditPlanDialogData
  ) {
    this.planForm = this.fb.group({
      name: [data?.name || '', Validators.required],
      description: [data?.description || ''],
    });
  }

  get validationMessages() {
    return VALIDATION_MESSAGES;
  }

  onSave(): void {
    if (this.planForm.invalid) {
      this.planForm.markAllAsTouched();
      return;
    }
    this.dialogRef.close({ save: true, value: this.planForm.value });
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  onDeletePlanRequest(): void {
    if (!this.data.isEditMode || !this.data) {
      console.error('Delete request called in invalid state.');
      return;
    }

    const confirmDialogRef = this.matDialog.open<ConfirmationDialogComponent, ConfirmationDialogData, boolean>(
      ConfirmationDialogComponent,
      {
        width: '400px',
        data: {
          title: 'Confirm Plan Deletion',
          message: `Are you sure you want to delete the plan "${this.data.name}"? This action cannot be undone.`,
          confirmButtonText: 'Delete Plan',
          cancelButtonText: 'Cancel',
        }
      }
    );

    confirmDialogRef.afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(confirmed => {
        if (confirmed) {
          this.dialogRef.close({ delete: true });
        }
      });
  }
}
