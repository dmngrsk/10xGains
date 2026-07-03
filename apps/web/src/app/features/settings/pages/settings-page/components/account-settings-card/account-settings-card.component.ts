import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';

@Component({
  selector: 'txg-account-settings-card',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule
  ],
  templateUrl: './account-settings-card.component.html'
})
export class AccountSettingsCardComponent {
  @Output() passwordChanged = new EventEmitter<void>();
  @Output() signedOut = new EventEmitter<void>();

  onPasswordChanged(): void {
    this.passwordChanged.emit();
  }

  onSignedOut(): void {
    this.signedOut.emit();
  }
}
