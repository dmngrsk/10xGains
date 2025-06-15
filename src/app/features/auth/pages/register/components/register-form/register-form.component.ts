import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, FormControl } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { RegisterCommand } from '@shared/services/auth.service';
import { LoaderButtonComponent } from '@shared/ui/components/loader-button/loader-button.component';
import { EmailInputComponent } from '../../../../components/email-input/email-input.component';
import { PasswordInputComponent } from '../../../../components/password-input/password-input.component';
import { passwordMatchValidator } from '../../../../utils/validators/password-match.validator';
import { passwordStrengthValidator } from '../../../../utils/validators/password-strength.validator';

@Component({
  selector: 'txg-register-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    EmailInputComponent,
    PasswordInputComponent,
    LoaderButtonComponent
  ],
  templateUrl: './register-form.component.html'
})
export class RegisterFormComponent {
  private fb = inject(FormBuilder);

  @Output() formSubmitted = new EventEmitter<RegisterCommand>();

  isLoading = signal(false);
  error = signal<string | null>(null);

  registerForm: FormGroup = this.fb.group({
    email: new FormControl('', [Validators.required, Validators.email]),
    password: new FormControl('', [Validators.required, passwordStrengthValidator()]),
    confirmPassword: new FormControl('', [Validators.required])
  }, {
    validators: passwordMatchValidator('password', 'confirmPassword')
  });

  setLoading(isLoading: boolean): void {
    this.isLoading.set(isLoading);
  }

  setError(error: string | null): void {
    this.error.set(error);
  }

  onSubmit(): void {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    this.formSubmitted.emit(this.registerForm.value as RegisterCommand);
  }
}
