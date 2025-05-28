import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { VALIDATION_MESSAGES } from '@shared/ui/messages/validation';

@Component({
  selector: 'txg-change-password-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule
  ],
  templateUrl: './change-password-dialog.component.html'
})
export class ChangePasswordDialogComponent {
  private readonly fb = inject(FormBuilder);
  public readonly dialogRef = inject(MatDialogRef<ChangePasswordDialogComponent>);

  changePasswordForm: FormGroup;

  get validationMessages() {
    return VALIDATION_MESSAGES;
  }

  constructor() {
    this.changePasswordForm = this.fb.group({
      newPassword: ['', [Validators.required, Validators.minLength(8)]],
      confirmNewPassword: ['', [Validators.required, Validators.minLength(8)]]
    }, { validators: passwordsMatchValidator });
  }

  onPasswordChanged(): void {
    if (this.changePasswordForm.valid) {
      const password = this.changePasswordForm.value.newPassword;
      this.dialogRef.close(password);
    }
  }
}

// TODO: Move to shared, reuse in the auth module (registration, password reset, etc.)
export function passwordsMatchValidator(control: AbstractControl): ValidationErrors | null {
  const newPassword = control.get('newPassword');
  const confirmNewPassword = control.get('confirmNewPassword');

  if (!newPassword || !confirmNewPassword) {
    return null;
  }

  if (confirmNewPassword.hasError('passwordsMismatch')) {
    const errors = { ...confirmNewPassword.errors };
    delete errors['passwordsMismatch'];
    confirmNewPassword.setErrors(Object.keys(errors).length > 0 ? errors : null);
  }

  if (newPassword.value !== confirmNewPassword.value) {
    confirmNewPassword.setErrors({ ...confirmNewPassword.errors, passwordsMismatch: true });
  }

  return null;
}
