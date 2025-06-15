import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, ViewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatCardModule } from '@angular/material/card';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService, LoginCommand, LoginResponse } from '@shared/services/auth.service';
import { AuthLayoutComponent } from '@shared/ui/layouts/auth-layout/auth-layout.component';
import { LoginActionsComponent } from './components/login-actions/login-actions.component';
import { LoginFormComponent } from './components/login-form/login-form.component';

@Component({
  selector: 'txg-login-page',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    AuthLayoutComponent,
    LoginFormComponent,
    LoginActionsComponent
  ],
  templateUrl: './login-page.component.html'
})
export class LoginPageComponent {
  private authService = inject(AuthService);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

  @ViewChild('loginForm') loginForm!: LoginFormComponent;

  onFormSubmitted(command: LoginCommand): void {
    if (!this.loginForm) return;

    this.loginForm.setLoading(true);
    this.loginForm.setError(null);

    this.authService
      .login(command)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.loginForm.setLoading(false))
      )
      .subscribe({
        next: (response: LoginResponse) => {
          if (response.success) {
            this.router.navigate(['/home']);
          } else {
            this.loginForm.setError(response.error || 'Login failed');
          }
        },
        error: (error: Error) => {
          this.loginForm.setError(error.message);
        }
      });
  }
}
