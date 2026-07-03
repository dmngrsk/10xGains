import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'txg-register-actions',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatButtonModule
  ],
  templateUrl: './register-actions.component.html'
})
export class RegisterActionsComponent {
}
