import { Component, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatSnackBar } from '@angular/material/snack-bar';
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
export class LoginComponent implements OnInit {
  private loginService = inject(LoginService);
  private snackBar = inject(MatSnackBar);

  @ViewChild('loginForm') loginFormComponent?: LoginFormComponent;

  ngOnInit(): void {
    // Check if user is already authenticated and redirect if needed
    this.loginService.redirectIfAuthenticated();
  }

  async onFormSubmit(formValues: LoginFormValues): Promise<void> {
    if (this.loginFormComponent) {
      this.loginFormComponent.setLoading(true);
    }

    try {
      await this.loginService.login({
        email: formValues.email,
        password: formValues.password
      });
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
