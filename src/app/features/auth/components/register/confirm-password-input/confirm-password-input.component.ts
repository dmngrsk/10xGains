import { CommonModule } from '@angular/common';
import { Component, Input, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';

@Component({
  selector: 'txg-confirm-password-input',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule
  ],
  templateUrl: './confirm-password-input.component.html'
})
export class ConfirmPasswordInputComponent {
  @Input({ required: true }) parentForm!: FormGroup;
  @Input() controlName = 'confirmPassword';

  hidePassword = signal(true);

  getFormControl(): FormControl {
    return this.parentForm.get(this.controlName) as FormControl;
  }

  togglePasswordVisibility(): void {
    this.hidePassword.update(current => !current);
  }
}
