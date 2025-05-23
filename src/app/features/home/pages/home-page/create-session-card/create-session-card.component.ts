import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'txg-create-session-card',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule
  ],
  templateUrl: './create-session-card.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreateSessionCardComponent {
  @Output() sessionCreated = new EventEmitter<void>();

  onSessionCreated(): void {
    this.sessionCreated.emit();
  }
}
