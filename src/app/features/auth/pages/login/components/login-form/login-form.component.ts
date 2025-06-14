import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { LoginCommand } from '@shared/services/auth.service';
import { EmailInputComponent } from '../../../../components/email-input/email-input.component';
import { PasswordInputComponent } from '../../../../components/password-input/password-input.component';

@Component({
  selector: 'txg-login-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    EmailInputComponent,
    PasswordInputComponent
  ],
  templateUrl: './login-form.component.html'
})
export class LoginFormComponent {
  private fb = inject(FormBuilder);

  @Output() formSubmitted = new EventEmitter<LoginCommand>();

  isLoading = signal(false);
  error = signal<string | null>(null);

  loginForm: FormGroup = this.fb.group({
    email: ['', [Validators.required]],
    password: ['', Validators.required]
  });

  setLoading(isLoading: boolean): void {
    this.isLoading.set(isLoading);
  }

  setError(error: string | null): void {
    this.error.set(error);
  }

  onSubmit(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.formSubmitted.emit(this.loginForm.value);
  }
}
