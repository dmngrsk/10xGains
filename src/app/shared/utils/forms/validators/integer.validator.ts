import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * Validator function to check if the control's value is an integer.
 * Allows positive, negative, or zero.
 * Passes if the control is empty, to be used in conjunction with Validators.required if needed.
 * @returns A ValidationErrors object if validation fails, otherwise null.
 */
export function integerValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (!control.value) {
      return null; // Don't validate empty values, let Validators.required handle that
    }
    const isValid = /^-?\d+$/.test(control.value);
    return isValid ? null : { integer: { value: control.value } };
  };
}
