import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'txg-session-actions',
  standalone: true,
  imports: [MatButtonModule, MatIconModule],
  templateUrl: './session-actions.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SessionActionsComponent {
  @Input() showPlateCalculator = false;

  @Output() readonly notesClicked = new EventEmitter<void>();
  @Output() readonly plateCalculatorClicked = new EventEmitter<void>();
}
