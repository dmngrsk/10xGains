import { Component, DestroyRef, inject, signal, ViewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs/operators';
import { AuthService, ResetPasswordResponse } from '@shared/services/auth.service';
import { AuthLayoutComponent } from '@shared/ui/layouts/auth-layout/auth-layout.component';
import { ForgotPasswordActionsComponent } from './components/forgot-password-actions/forgot-password-actions.component';
import { ForgotPasswordFormComponent } from './components/forgot-password-form/forgot-password-form.component';

@Component({
  selector: 'txg-forgot-password-page',
  standalone: true,
  imports: [
    AuthLayoutComponent,
    ForgotPasswordFormComponent,
    ForgotPasswordActionsComponent
  ],
  templateUrl: './forgot-password-page.component.html',
})
export class ForgotPasswordPageComponent {
  private authService = inject(AuthService);
  private destroyRef = inject(DestroyRef);

  passwordResetRequested = signal(false);
  @ViewChild('forgotPasswordForm') forgotPasswordForm!: ForgotPasswordFormComponent;

  onFormSubmitted(email: string): void {
    if (!this.forgotPasswordForm) return;

    this.forgotPasswordForm.setLoading(true);
    this.forgotPasswordForm.setError(null);

    this.authService.resetPassword({ email })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.forgotPasswordForm.setLoading(false))
      )
      .subscribe({
        next: (response: ResetPasswordResponse) => {
          if (response.success) {
            this.passwordResetRequested.set(true);
          } else {
            this.forgotPasswordForm.setError(response.error || 'Password reset failed');
          }
        },
        error: (error: Error) => {
          this.forgotPasswordForm.setError(error.message);
        }
      });
  }
}
