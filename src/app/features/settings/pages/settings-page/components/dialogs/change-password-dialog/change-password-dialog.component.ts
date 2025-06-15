import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { PasswordInputComponent } from '@features/auth/components/password-input/password-input.component';
import { passwordMatchValidator } from '@features/auth/utils/validators/password-match.validator';
import { passwordStrengthValidator } from '@features/auth/utils/validators/password-strength.validator';
import { VALIDATION_MESSAGES } from '@shared/ui/messages/validation';

@Component({
  selector: 'txg-change-password-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    PasswordInputComponent
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
      newPassword: ['', [Validators.required, passwordStrengthValidator()]],
      confirmNewPassword: ['', [Validators.required]]
    }, { validators: passwordMatchValidator('newPassword', 'confirmNewPassword') });
  }

  onPasswordChanged(): void {
    if (this.changePasswordForm.valid) {
      const password = this.changePasswordForm.value.newPassword;
      this.dialogRef.close(password);
    }
  }
}
