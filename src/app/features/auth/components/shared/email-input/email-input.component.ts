import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

@Component({
  selector: 'txg-email-input',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule
  ],
  templateUrl: './email-input.component.html',
})
export class EmailInputComponent {
  @Input({ required: true }) parentForm!: FormGroup;
  @Input() controlName = 'email';

  getFormControl(): FormControl {
    return this.parentForm.get(this.controlName) as FormControl;
  }
}
