import { CommonModule } from '@angular/common';
import { Component, DestroyRef, ViewChild, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router, RouterModule } from '@angular/router';
import { AuthService, RegisterCommand, RegisterResponse } from '@shared/services/auth.service';
import { AuthLayoutComponent } from '@shared/ui/layouts/auth-layout/auth-layout.component';
import { RegisterActionsComponent } from './components/register-actions/register-actions.component';
import { RegisterFormComponent } from './components/register-form/register-form.component';

@Component({
  selector: 'txg-register-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    AuthLayoutComponent,
    RegisterActionsComponent,
    RegisterFormComponent
  ],
  templateUrl: './register-page.component.html'
})
export class RegisterPageComponent {
  private authService = inject(AuthService);
  private router = inject(Router);
  private snackBar = inject(MatSnackBar);
  private destroyRef = inject(DestroyRef);

  isRegistered = signal(false);
  @ViewChild('registerForm') registerForm!: RegisterFormComponent;

  onFormSubmitted(request: RegisterCommand): void {
    if (!this.registerForm) return;

    this.registerForm.setLoading(true);
    this.registerForm.setError(null);

    this.authService.register(request)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result: RegisterResponse) => {
          if (result.success) {
            if (result.emailVerified) {
              this.snackBar.open('Registration successful! Welcome to 10xGains.', 'Close', { duration: 5000 });
              this.router.navigate(['/home']);
            } else {
              this.isRegistered.set(true);
            }
          } else {
            this.registerForm.setError(result.error || 'An unexpected error occurred.');
            this.registerForm.setLoading(false);
          }
        },
        error: (error: Error) => {
          this.registerForm.setError(error.message);
          this.registerForm.setLoading(false);
        }
      });
  }
}
