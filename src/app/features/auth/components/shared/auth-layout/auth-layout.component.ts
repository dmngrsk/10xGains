import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';

@Component({
  selector: 'txg-auth-layout',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule
  ],
  templateUrl: './auth-layout.component.html'
})
export class AuthLayoutComponent {
  @Input() title = '10xGains';
  @Input() subtitle = '';
}
