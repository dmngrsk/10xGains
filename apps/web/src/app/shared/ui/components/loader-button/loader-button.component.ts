import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@Component({
  selector: 'txg-loader-button',
  standalone: true,
  imports: [CommonModule, MatProgressSpinnerModule, MatButtonModule],
  templateUrl: './loader-button.component.html',
})
export class LoaderButtonComponent {
  @Input() isLoading = false;
  @Input() disabled = false;
}
