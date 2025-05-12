import { CommonModule } from '@angular/common';
import { Component, ViewChild, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router, RouterModule } from '@angular/router';
import { AuthLayoutComponent } from '@shared/ui/layouts/auth-layout/auth-layout.component';
import { ActionsComponent } from './actions/actions.component';
import { RegisterFormComponent, RegisterFormValues } from './register-form/register-form.component';
import { RegisterService } from './services/register.service';

@Component({
  selector: 'txg-register',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    AuthLayoutComponent,
    RegisterFormComponent,
    ActionsComponent
  ],
  templateUrl: './register.component.html'
})
export class RegisterComponent {
  private registerService = inject(RegisterService);
  private router = inject(Router);
  private snackBar = inject(MatSnackBar);

  @ViewChild('registerForm') registerForm!: RegisterFormComponent;

  async onFormSubmit(formValues: RegisterFormValues): Promise<void> {
    if (!this.registerForm) return;

    this.registerForm.setLoading(true);
    this.registerForm.setServerError(null);

    const { email, password } = formValues;

    try {
      const result = await this.registerService.registerAndSignIn({ email, password });

      this.registerForm.setLoading(false);

      if (!result.success) {
        this.registerForm.setServerError(result.error || null);
        this.snackBar.open(result.error || 'Registration failed', 'Close', { duration: 5000 });
        return;
      }

      this.snackBar.open('Registration successful! Welcome to 10xGains.', 'Close', { duration: 5000 });
      this.router.navigate(['/home']);
    } catch {
      this.registerForm.setLoading(false);
      this.registerForm.setServerError('An unexpected error occurred');
      this.snackBar.open('An unexpected error occurred. Please try again later.', 'Close', { duration: 5000 });
    }
  }
}
