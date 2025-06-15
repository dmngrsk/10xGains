import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { ResetPasswordCommand } from '@shared/services/auth.service';
import { LoaderButtonComponent } from '@shared/ui/components/loader-button/loader-button.component';
import { EmailInputComponent } from '../../../../components/email-input/email-input.component';

@Component({
  selector: 'txg-reset-password-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    EmailInputComponent,
    LoaderButtonComponent
  ],
  templateUrl: './reset-password-form.component.html'
})
export class ResetPasswordFormComponent {
  private fb = inject(FormBuilder);

  @Output() formSubmitted = new EventEmitter<ResetPasswordCommand>();

  isLoading = signal(false);
  error = signal<string | null>(null);

  resetPasswordForm: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]]
  });

  setLoading(isLoading: boolean): void {
    this.isLoading.set(isLoading);
  }

  setError(error: string | null): void {
    this.error.set(error);
  }

  onSubmit(): void {
    if (this.resetPasswordForm.invalid) {
      this.resetPasswordForm.markAllAsTouched();
      return;
    }

    this.formSubmitted.emit(this.resetPasswordForm.value);
  }
}
