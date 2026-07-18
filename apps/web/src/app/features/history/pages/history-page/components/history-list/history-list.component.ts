import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { SessionListComponent } from '@features/sessions/components/session-list/session-list.component';
import { SessionCardViewModel } from '@features/sessions/models/session-card.viewmodel';
import { NoticeComponent } from '@shared/ui/components/notice/notice.component';

@Component({
  selector: 'txg-history-list',
  standalone: true,
  imports: [
    CommonModule,
    SessionListComponent,
    NoticeComponent,
  ],
  templateUrl: './history-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HistoryListComponent {
  @Input() sessions: SessionCardViewModel[] = [];

  @Output() sessionNavigated = new EventEmitter<string>();
  @Output() notesClicked = new EventEmitter<string>();
  @Output() editFiltersClicked = new EventEmitter<void>();

  onSessionNavigated(sessionId: string): void {
    this.sessionNavigated.emit(sessionId);
  }

  onNotesClicked(sessionId: string): void {
    this.notesClicked.emit(sessionId);
  }

  onEditFiltersClicked(): void {
    this.editFiltersClicked.emit();
  }
}
