import { CommonModule, NgOptimizedImage } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'txg-auth-layout',
  standalone: true,
  imports: [
    CommonModule,
    NgOptimizedImage
  ],
  templateUrl: './auth-layout.component.html'
})
export class AuthLayoutComponent {
  @Input() subtitle = '';
}
