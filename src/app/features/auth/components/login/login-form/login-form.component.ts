import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { zodFormGroupValidator } from '@shared/utils/forms/form-validation';
import { LoginFormValues, loginFormSchema } from '../../../shared/types';
import { EmailInputComponent } from '../../shared/email-input/email-input.component';
import { PasswordInputComponent } from '../../shared/password-input/password-input.component';

@Component({
  selector: 'txg-login-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    EmailInputComponent,
    PasswordInputComponent
  ],
  templateUrl: './login-form.component.html'
})
export class LoginFormComponent {
  private fb = inject(FormBuilder);

  @Output() formSubmit = new EventEmitter<LoginFormValues>();

  isLoading = signal(false);

  loginForm: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required]
  }, {
    validators: zodFormGroupValidator(loginFormSchema)
  });

  setLoading(isLoading: boolean): void {
    this.isLoading.set(isLoading);
  }

  onSubmit(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.formSubmit.emit(this.loginForm.value);
  }
}
