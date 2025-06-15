import { CommonModule } from '@angular/common';
import { Component, inject, Injector, Input, OnInit } from '@angular/core';
import { ControlValueAccessor, FormControl, NgControl, NG_VALUE_ACCESSOR, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { VALIDATION_MESSAGES } from '@shared/ui/messages/validation';

@Component({
  selector: 'txg-password-input',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule
  ],
  templateUrl: './password-input.component.html',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: PasswordInputComponent,
      multi: true
    }
  ]
})
export class PasswordInputComponent implements ControlValueAccessor, OnInit {
  @Input() label = 'Password';

  value: string = '';
  isDisabled = false;
  passwordVisible = false;
  validationMessages = VALIDATION_MESSAGES;
  ngControl: NgControl | null = null;

  private injector = inject(Injector);

  onChange: (value: string) => void = () => {};
  onTouched: () => void = () => {};

  ngOnInit(): void {
    this.ngControl = this.injector.get(NgControl, null);
    if (this.ngControl) {
      this.ngControl.valueAccessor = this;
    }
  }

  get formControl(): FormControl {
    return this.ngControl?.control as FormControl;
  }

  writeValue(value: string): void {
    this.value = value;
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.isDisabled = isDisabled;
  }

  onValueChange(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.onChange(value);
  }

  togglePasswordVisibility(): void {
    this.passwordVisible = !this.passwordVisible;
  }
}
