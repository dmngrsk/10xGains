import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'txg-reset-password-actions',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    RouterLink
  ],
  templateUrl: './reset-password-actions.component.html'
})
export class ResetPasswordActionsComponent {
}
