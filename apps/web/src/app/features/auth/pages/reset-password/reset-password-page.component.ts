import { Component, DestroyRef, inject, signal, ViewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService, ResetPasswordCommand, ResetPasswordResponse } from '@shared/services/auth.service';
import { AuthLayoutComponent } from '@shared/ui/layouts/auth-layout/auth-layout.component';
import { ResetPasswordActionsComponent } from './components/reset-password-actions/reset-password-actions.component';
import { ResetPasswordFormComponent } from './components/reset-password-form/reset-password-form.component';

@Component({
  selector: 'txg-reset-password-page',
  standalone: true,
  imports: [
    AuthLayoutComponent,
    ResetPasswordFormComponent,
    ResetPasswordActionsComponent
  ],
  templateUrl: './reset-password-page.component.html',
})
export class ResetPasswordPageComponent {
  private authService = inject(AuthService);
  private destroyRef = inject(DestroyRef);

  passwordResetRequested = signal(false);
  @ViewChild('resetPasswordForm') resetPasswordForm!: ResetPasswordFormComponent;

  onFormSubmitted(command: ResetPasswordCommand): void {
    if (!this.resetPasswordForm) return;

    this.resetPasswordForm.setLoading(true);
    this.resetPasswordForm.setError(null);

    this.authService.resetPassword(command)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response: ResetPasswordResponse) => {
          if (response.success) {
            this.passwordResetRequested.set(true);
          } else {
            this.resetPasswordForm.setError(response.error || 'Password reset failed');
            this.resetPasswordForm.setLoading(false)
          }
        },
        error: (error: Error) => {
          this.resetPasswordForm.setError(error.message);
          this.resetPasswordForm.setLoading(false)
        }
      });
  }
}
