import { FormControl } from '@angular/forms';
import { describe, expect, it } from 'vitest';
import { passwordStrengthValidator } from './password-strength.validator';

describe('passwordStrengthValidator', () => {
  const validator = passwordStrengthValidator();

  it('should return null for a valid password', () => {
    const control = new FormControl('ValidP@ssw0rd');
    expect(validator(control)).toBeNull();
  });

  it('should return null for an empty value', () => {
    const control = new FormControl('');
    expect(validator(control)).toBeNull();
  });

  it('should return an error object with requiresLength for a password shorter than 8 characters', () => {
    const control = new FormControl('V@l1dP');
    expect(validator(control)).toEqual({ requiresLength: true });
  });

  it('should return an error object with requiresUppercase when no uppercase letter is present', () => {
    const control = new FormControl('validp@ssw0rd');
    expect(validator(control)).toEqual({ requiresUppercase: true });
  });

  it('should return an error object with requiresLowercase when no lowercase letter is present', () => {
    const control = new FormControl('VALIDP@SSW0RD');
    expect(validator(control)).toEqual({ requiresLowercase: true });
  });

  it('should return an error object with requiresNumeric when no number is present', () => {
    const control = new FormControl('ValidP@ssword');
    expect(validator(control)).toEqual({ requiresNumeric: true });
  });

  it('should return an error object with requiresSpecial when no special character is present', () => {
    const control = new FormControl('ValidPassword1');
    expect(validator(control)).toEqual({ requiresSpecial: true });
  });

  it('should return an error object with multiple keys for multiple violations', () => {
    const control = new FormControl('short');
    const errors = validator(control);
    expect(errors).toHaveProperty('requiresLength');
    expect(errors).toHaveProperty('requiresUppercase');
    expect(errors).toHaveProperty('requiresNumeric');
    expect(errors).toHaveProperty('requiresSpecial');
  });

  it('should handle a password that is exactly 8 characters long and valid', () => {
    const control = new FormControl('V@lidP_1');
    expect(validator(control)).toBeNull();
  });
});
