import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { GoogleIconComponent } from '@shared/ui/components/google-icon/google-icon.component';
import { AccountSettingsCardViewModel } from '../../../../models/settings-page.viewmodel';

@Component({
  selector: 'txg-account-settings-card',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    GoogleIconComponent
  ],
  templateUrl: './account-settings-card.component.html'
})
export class AccountSettingsCardComponent {
  @Input() account: AccountSettingsCardViewModel | null = null;
  @Output() passwordChanged = new EventEmitter<void>();
  @Output() signedOut = new EventEmitter<void>();
  @Output() googleConnected = new EventEmitter<void>();
  @Output() googleDisconnected = new EventEmitter<void>();

  onPasswordChanged(): void {
    this.passwordChanged.emit();
  }

  onSignedOut(): void {
    this.signedOut.emit();
  }

  onGoogleConnected(): void {
    this.googleConnected.emit();
  }

  onGoogleDisconnected(): void {
    this.googleDisconnected.emit();
  }
}
