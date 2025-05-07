import { Component, Input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

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
