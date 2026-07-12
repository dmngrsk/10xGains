import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input, Output, EventEmitter } from '@angular/core';
import { SessionCardViewModel } from '../../models/session-card.viewmodel';
import { SessionCardComponent } from '../session-card/session-card.component';

@Component({
  selector: 'txg-session-list',
  standalone: true,
  imports: [
    CommonModule,
    SessionCardComponent,
  ],
  templateUrl: './session-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SessionListComponent {
  @Input() sessions: SessionCardViewModel[] | null = null;
  @Input() notesAccessible = false;
  @Output() sessionNavigated = new EventEmitter<string>();
  @Output() notesClicked = new EventEmitter<string>();

  onSessionNavigated(sessionId: string): void {
    this.sessionNavigated.emit(sessionId);
  }

  onNotesClicked(sessionId: string): void {
    this.notesClicked.emit(sessionId);
  }
}
