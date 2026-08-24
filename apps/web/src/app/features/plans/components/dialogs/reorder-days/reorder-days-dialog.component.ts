import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

export interface ReorderDaysDialogItem {
  id: string;
  name: string;
}

export interface ReorderDaysDialogData {
  days: ReorderDaysDialogItem[];
}

export type ReorderDaysDialogCloseResult =
  | { save: true; value: ReorderDaysDialogItem[] }
  | undefined;

@Component({
  selector: 'txg-reorder-days-dialog',
  templateUrl: './reorder-days-dialog.component.html',
  styleUrl: './reorder-days-dialog.component.scss',
  standalone: true,
  imports: [
    CommonModule,
    DragDropModule,
    MatButtonModule,
    MatDialogModule,
    MatIconModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReorderDaysDialogComponent {
  readonly dialogRef = inject<MatDialogRef<ReorderDaysDialogComponent, ReorderDaysDialogCloseResult>>(MatDialogRef);
  private readonly data = inject<ReorderDaysDialogData>(MAT_DIALOG_DATA);

  readonly days = signal<ReorderDaysDialogItem[]>([...this.data.days]);

  onDropped(event: CdkDragDrop<ReorderDaysDialogItem[]>): void {
    if (event.previousIndex === event.currentIndex) {
      return;
    }

    const next = [...this.days()];
    moveItemInArray(next, event.previousIndex, event.currentIndex);
    this.days.set(next);
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  onSave(): void {
    this.dialogRef.close({ save: true, value: this.days() });
  }
}
