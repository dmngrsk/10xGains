import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { SessionCardViewModel } from '@features/sessions/models/session-card.viewmodel';
import { NoticeComponent } from '@shared/ui/components/notice/notice.component';

@Component({
  selector: 'txg-history-notes',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    NoticeComponent,
  ],
  templateUrl: './history-notes.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HistoryNotesComponent {
  @Input() sessions: SessionCardViewModel[] = [];

  @Output() sessionNavigated = new EventEmitter<string>();
  @Output() editFiltersClicked = new EventEmitter<void>();

  formatSessionDate(date: Date | null): string {
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
      return '';
    }

    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
  }

  onSpaceActivated(event: Event, sessionId: string): void {
    event.preventDefault();
    this.sessionNavigated.emit(sessionId);
  }

  onSessionNavigated(sessionId: string): void {
    this.sessionNavigated.emit(sessionId);
  }

  onEditFiltersClicked(): void {
    this.editFiltersClicked.emit();
  }
}
