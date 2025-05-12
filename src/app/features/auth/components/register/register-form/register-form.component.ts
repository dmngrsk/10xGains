import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { passwordMatchValidator } from '../../../shared/validators/password-match.validator';
import { EmailInputComponent } from '../../shared/email-input/email-input.component';
import { PasswordInputComponent } from '../../shared/password-input/password-input.component';
import { ConfirmPasswordInputComponent } from '../confirm-password-input/confirm-password-input.component';

export interface RegisterFormValues {
  email: string;
  password: string;
  confirmPassword: string;
}

@Component({
  selector: 'txg-register-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    EmailInputComponent,
    PasswordInputComponent,
    ConfirmPasswordInputComponent
  ],
  templateUrl: './register-form.component.html'
})
export class RegisterFormComponent {
  private fb = inject(FormBuilder);

  @Output() formSubmit = new EventEmitter<RegisterFormValues>();

  isLoading = signal(false);
  serverError = signal<string | null>(null);

  registerForm: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    confirmPassword: ['', [Validators.required]]
  }, {
    validators: passwordMatchValidator('password', 'confirmPassword')
  });

  setLoading(isLoading: boolean): void {
    this.isLoading.set(isLoading);
  }

  setServerError(error: string | null): void {
    this.serverError.set(error);
  }

  onSubmit(): void {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    this.formSubmit.emit(this.registerForm.value);
  }
}
