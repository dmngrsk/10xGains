import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * Custom validator to check for password strength.
 *
 * This validator checks if the password meets the following criteria:
 * - At least 8 characters long
 * - Contains at least one uppercase letter
 * - Contains at least one lowercase letter
 * - Contains at least one numeric digit
 * - Contains at least one special character
 *
 * @returns A ValidatorFn that returns an object of errors if the password is weak, or null if it's strong.
 */
export function passwordStrengthValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;
    if (!value) {
      return null;
    }

    const errors: ValidationErrors = {};

    if (value.length < 8) {
      errors['requiresLength'] = true;
    }
    if (!/[A-Z]+/.test(value)) {
      errors['requiresUppercase'] = true;
    }
    if (!/[a-z]+/.test(value)) {
      errors['requiresLowercase'] = true;
    }
    if (!/[0-9]+/.test(value)) {
      errors['requiresNumeric'] = true;
    }
    if (!/[!@#$%^&*(),.?":{}|<>]+/.test(value)) {
      errors['requiresSpecial'] = true;
    }

    return Object.keys(errors).length ? errors : null;
  };
}
