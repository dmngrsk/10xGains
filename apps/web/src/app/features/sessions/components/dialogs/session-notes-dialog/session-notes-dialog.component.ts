import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

export const NOTES_MAX_LENGTH = 5000;

export interface SessionNotesDialogData {
  sessionNotes: string | null;
  planNotes?: string | null;
}

export interface SessionNotesDialogResult {
  sessionNotes: string | null;
  planNotes?: string | null;
}

@Component({
  selector: 'txg-session-notes-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule
  ],
  templateUrl: './session-notes-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SessionNotesDialogComponent {
  private readonly dialogRef = inject<MatDialogRef<SessionNotesDialogComponent, SessionNotesDialogResult>>(MatDialogRef);
  private readonly fb = inject(FormBuilder);

  readonly data = inject<SessionNotesDialogData>(MAT_DIALOG_DATA);
  readonly maxLength = NOTES_MAX_LENGTH;
  readonly showPlanNotes = this.data.planNotes !== undefined;

  readonly notesForm = this.fb.group({
    sessionNotes: [this.data.sessionNotes ?? '', [Validators.maxLength(NOTES_MAX_LENGTH)]],
    planNotes: [this.data.planNotes ?? '', [Validators.maxLength(NOTES_MAX_LENGTH)]],
  });

  onSave(): void {
    this.closeWithResult();
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  private closeWithResult(): void {
    const { sessionNotes, planNotes } = this.notesForm.value;
    const result: SessionNotesDialogResult = {
      sessionNotes: this.normalize(sessionNotes),
      ...(this.showPlanNotes ? { planNotes: this.normalize(planNotes) } : {}),
    };
    this.dialogRef.close(result);
  }

  private normalize(value: string | null | undefined): string | null {
    const trimmed = (value ?? '').trim();
    return trimmed.length > 0 ? trimmed.slice(0, NOTES_MAX_LENGTH) : null;
  }
}
