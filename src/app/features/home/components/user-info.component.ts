import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { AuthService } from '@shared/services/auth.service';

@Component({
  selector: 'txg-user-info',
  standalone: true,
  imports: [CommonModule, MatButtonModule],
  template: `
    <div class="p-4 border rounded shadow-sm">
      <div *ngIf="authService.currentUser() as user; else loading">
        <p class="mb-2">Signed in as: <strong>{{ user.email }}</strong></p>
        <div class="mt-4">
          <button mat-button color="warn" (click)="logout()">Wyloguj</button>
        </div>
      </div>
      <ng-template #loading>
        <p>Loading user data...</p>
      </ng-template>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }
  `]
})
export class UserInfoComponent {
  protected authService = inject(AuthService);
  private router = inject(Router);

  logout(): void {
    this.authService.logout().then(() => {
      this.router.navigate(['/auth/login']);
    }).catch(error => {
      console.error('Error during logout:', error);
    });
  }
}
