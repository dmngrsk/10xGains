import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { EmailInputComponent } from '../../../../components/email-input/email-input.component';

@Component({
  selector: 'txg-forgot-password-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    EmailInputComponent
  ],
  templateUrl: './forgot-password-form.component.html'
})
export class ForgotPasswordFormComponent {
  private fb = inject(FormBuilder);

  @Output() formSubmitted = new EventEmitter<string>();

  isLoading = signal(false);
  error = signal<string | null>(null);

  forgotPasswordForm: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]]
  });

  setLoading(isLoading: boolean): void {
    this.isLoading.set(isLoading);
  }

  setError(error: string | null): void {
    this.error.set(error);
  }

  onSubmit(): void {
    if (this.forgotPasswordForm.invalid) {
      this.forgotPasswordForm.markAllAsTouched();
      return;
    }

    this.formSubmitted.emit(this.forgotPasswordForm.value.email);
  }
}
