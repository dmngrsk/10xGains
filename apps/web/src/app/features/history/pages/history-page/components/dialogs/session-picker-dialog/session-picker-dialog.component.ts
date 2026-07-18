import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { SessionCardViewModel } from '@features/sessions/models/session-card.viewmodel';

export interface SessionPickerDialogData {
  date: Date;
  sessions: SessionCardViewModel[];
}

@Component({
  selector: 'txg-session-picker-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
  ],
  templateUrl: './session-picker-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SessionPickerDialogComponent {
  readonly dialogRef = inject<MatDialogRef<SessionPickerDialogComponent, string>>(MatDialogRef);
  readonly data = inject<SessionPickerDialogData>(MAT_DIALOG_DATA);

  exerciseNames(session: SessionCardViewModel): string {
    return session.exercises.map(exercise => exercise.name).join(' · ');
  }

  onSessionPicked(sessionId: string): void {
    this.dialogRef.close(sessionId);
  }

  onCancelled(): void {
    this.dialogRef.close();
  }
}
