import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatSnackBar } from '@angular/material/snack-bar';
import { RouterLink } from '@angular/router';
import { AuthService, LoginResponse } from '@shared/services/auth.service';
import { AuthLayoutComponent } from '@shared/ui/layouts/auth-layout/auth-layout.component';
import { AuthMethodButtonComponent } from '../../components/auth-method-button/auth-method-button.component';

@Component({
  selector: 'txg-welcome-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    AuthLayoutComponent,
    AuthMethodButtonComponent
  ],
  templateUrl: './welcome-page.component.html'
})
export class WelcomePageComponent {
  private authService = inject(AuthService);
  private snackBar = inject(MatSnackBar);
  private destroyRef = inject(DestroyRef);

  onGoogleClicked(): void {
    this.authService
      .loginWithGoogle()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((response: LoginResponse) => {
        if (!response.success) {
          this.snackBar.open(response.error || 'Google sign-in failed', 'Close', { duration: 3000 });
        }
      });
  }
}
