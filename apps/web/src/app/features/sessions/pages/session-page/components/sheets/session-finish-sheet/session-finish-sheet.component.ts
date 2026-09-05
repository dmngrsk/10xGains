import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnDestroy, inject } from '@angular/core';
import { MatBottomSheetRef, MAT_BOTTOM_SHEET_DATA } from '@angular/material/bottom-sheet';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { Subject } from 'rxjs';

export interface SessionFinishSheetData {
  now: Date;
  lastSetCompletedAt: Date | null;
}

export type SessionFinishSheetResult =
  | { kind: 'now' }
  | { kind: 'lastSet'; endAt: string }
  | { kind: 'pick' };

@Component({
  selector: 'txg-session-finish-sheet',
  standalone: true,
  imports: [CommonModule, MatListModule, MatIconModule],
  templateUrl: './session-finish-sheet.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SessionFinishSheetComponent implements OnDestroy {
  private readonly sheetRef = inject<MatBottomSheetRef<SessionFinishSheetComponent>>(MatBottomSheetRef);

  readonly data = inject<SessionFinishSheetData>(MAT_BOTTOM_SHEET_DATA);
  readonly choice = new Subject<SessionFinishSheetResult>();

  get showLastSetOption(): boolean {
    return !!this.data.lastSetCompletedAt;
  }

  onFinishNow(): void {
    this.select({ kind: 'now' });
  }

  onFinishAtLastSet(): void {
    this.select({ kind: 'lastSet', endAt: this.data.lastSetCompletedAt!.toISOString() });
  }

  onPickDateTime(): void {
    this.select({ kind: 'pick' });
  }

  ngOnDestroy(): void {
    this.choice.complete();
  }

  private select(choice: SessionFinishSheetResult): void {
    this.choice.next(choice);
    this.sheetRef.dismiss();
  }
}
