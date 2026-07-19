import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { GoogleIconComponent } from '@shared/ui/components/google-icon/google-icon.component';

@Component({
  selector: 'txg-google-button',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    GoogleIconComponent
  ],
  templateUrl: './google-button.component.html'
})
export class GoogleButtonComponent {
  @Input() dataCy = 'google-button';
  @Output() googleClicked = new EventEmitter<void>();

  onGoogleClicked(): void {
    this.googleClicked.emit();
  }
}
