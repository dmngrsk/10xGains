import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Inject, inject, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogRef , MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { PlanDayDto } from '@shared/api/api.types';
import { ConfirmationDialogComponent, ConfirmationDialogData } from '@shared/ui/dialogs/confirmation-dialog/confirmation-dialog.component';
import { VALIDATION_MESSAGES } from '@shared/ui/messages/validation';

export type AddEditDayDialogValue = Pick<PlanDayDto, 'name' | 'description'>;
export type AddEditDayDialogData = Partial<AddEditDayDialogValue> & { isEditMode?: boolean; }
export type AddEditDayDialogCloseResult =
  | { save: true; value: AddEditDayDialogValue }
  | { delete: true }
  | undefined;

@Component({
  selector: 'txg-add-edit-day-dialog',
  templateUrl: './add-edit-day-dialog.component.html',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatDialogModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddEditDayDialogComponent {
  protected dayForm: FormGroup;
  private readonly fb = inject(FormBuilder);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);

  constructor(
    public dialogRef: MatDialogRef<AddEditDayDialogComponent, AddEditDayDialogCloseResult>,
    @Inject(MAT_DIALOG_DATA) public data: AddEditDayDialogData
  ) {
    this.dayForm = this.fb.group({
      name: [this.data?.name || '', Validators.required],
      description: [this.data?.description || '']
    });
  }

  get validationMessages() {
    return VALIDATION_MESSAGES;
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  onSave(): void {
    if (this.dayForm.valid) {
      this.dialogRef.close({
        save: true,
        value: this.dayForm.value,
      });
    }
  }

  onDeleteDay(): void {
    if (!this.data) {
      console.error('Attempted to delete a day but no day data was provided to the dialog.');
      return;
    }
    const dialogRef = this.dialog.open<ConfirmationDialogComponent, ConfirmationDialogData, boolean>(
      ConfirmationDialogComponent,
      {
        data: {
          title: 'Delete Day',
          message: `Are you sure you want to delete the day "${this.data.name || 'this day'}"? All its exercises and sets will also be removed.`,
          confirmButtonText: 'Delete',
          cancelButtonText: 'Cancel',
        }
      }
    );

    dialogRef.afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(confirmed => {
        if (confirmed && this.data) {
          this.dialogRef.close({ delete: true });
        }
      });
  }
}
