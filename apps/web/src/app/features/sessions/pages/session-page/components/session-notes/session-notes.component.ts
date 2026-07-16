import { ChangeDetectionStrategy, Component, EventEmitter, Output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'txg-session-notes',
  standalone: true,
  imports: [MatButtonModule, MatIconModule],
  templateUrl: './session-notes.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SessionNotesComponent {
  @Output() readonly notesClicked = new EventEmitter<void>();
}
