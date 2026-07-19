import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { GoogleIconComponent } from '@shared/ui/components/google-icon/google-icon.component';

export type AuthMethod = 'google' | 'email';

@Component({
  selector: 'txg-auth-method-button',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    GoogleIconComponent
  ],
  templateUrl: './auth-method-button.component.html'
})
export class AuthMethodButtonComponent {
  @Input() method: AuthMethod = 'google';
  @Output() clicked = new EventEmitter<void>();

  get dataCy(): string {
    return `welcome-${this.method}-auth-button`;
  }

  onClicked(): void {
    this.clicked.emit();
  }
}
