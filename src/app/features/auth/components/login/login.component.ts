import { Component, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { LoginFormComponent } from './login-form/login-form.component';
import { ActionsComponent } from './actions/actions.component';
import { LoginService } from './services/login.service';
import { LoginFormValues } from '../../shared/types';
import { AuthLayoutComponent } from '../shared/auth-layout/auth-layout.component';

@Component({
  selector: 'txg-login',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    AuthLayoutComponent,
    LoginFormComponent,
    ActionsComponent
  ],
  templateUrl: './login.component.html'
})
export class LoginComponent {
  private loginService = inject(LoginService);
  private router = inject(Router);
  private snackBar = inject(MatSnackBar);

  @ViewChild('loginForm') loginFormComponent?: LoginFormComponent;

  async onFormSubmit(formValues: LoginFormValues): Promise<void> {
    if (this.loginFormComponent) {
      this.loginFormComponent.setLoading(true);
    }

    try {
      await this.loginService.login({
        email: formValues.email,
        password: formValues.password
      });

      // Navigate to home page after successful login
      await this.router.navigate(['/home']);
    } catch (error) {
      // Display error message from service
      this.snackBar.open(
        error instanceof Error ? error.message : 'An error occurred. Please try again later.',
        'Close',
        { duration: 5000 }
      );
    } finally {
      if (this.loginFormComponent) {
        this.loginFormComponent.setLoading(false);
      }
    }
  }
}
