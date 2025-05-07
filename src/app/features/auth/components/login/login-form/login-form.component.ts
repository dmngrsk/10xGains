import { Component, EventEmitter, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';

import { EmailInputComponent } from '../email-input/email-input.component';
import { PasswordInputComponent } from '../password-input/password-input.component';
import { LoginFormValues, loginFormSchema } from '../../../shared/types';
import { zodFormGroupValidator } from '../../../../../shared/utils/form-validation';

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
      // Mark all fields as touched to show validation errors
      this.loginForm.markAllAsTouched();
      return;
    }

    this.formSubmit.emit(this.loginForm.value);
  }
}
