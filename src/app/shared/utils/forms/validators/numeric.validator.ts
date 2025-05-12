import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * Validator function to check if the control's value is a numeric number (integer or decimal).
 * Allows positive, negative, or zero. Allows decimal points.
 * Passes if the control is empty, to be used in conjunction with Validators.required if needed.
 * @returns A ValidationErrors object if validation fails, otherwise null.
 */
export function numericValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (!control.value) {
      return null; // Don't validate empty values, let Validators.required handle that
    }
    // Allows: -123, 123, 123.45, -123.45, .5, -.5
    // Note: HTML5 type="number" often handles localization of decimal separator better.
    // This regex assumes '.' as decimal separator.
    const isValid = /^-?\d*(\.\d+)?$/.test(control.value);
    return isValid ? null : { numeric: { value: control.value } };
  };
}
