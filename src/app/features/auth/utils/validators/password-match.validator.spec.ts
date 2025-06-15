import { FormControl, FormGroup } from '@angular/forms';
import { describe, expect, it } from 'vitest';
import { passwordMatchValidator } from './password-match.validator';

describe('passwordMatchValidator', () => {
  const validator = passwordMatchValidator('password', 'confirmPassword');

  it('should return null if passwords match', () => {
    const formGroup = new FormGroup({
      password: new FormControl('password123'),
      confirmPassword: new FormControl('password123')
    });
    expect(validator(formGroup)).toBeNull();
  });

  it('should return a passwordMismatch error if passwords do not match', () => {
    const formGroup = new FormGroup({
      password: new FormControl('password123'),
      confirmPassword: new FormControl('password456')
    });
    expect(validator(formGroup)).toEqual({ passwordMismatch: true });
  });

  it('should set the passwordMismatch error on the matching control when passwords do not match', () => {
    const formGroup = new FormGroup({
      password: new FormControl('password123'),
      confirmPassword: new FormControl('password456')
    });
    validator(formGroup);
    expect(formGroup.get('confirmPassword')?.hasError('passwordMismatch')).toBe(true);
  });

  it('should clear the passwordMismatch error on the matching control when passwords match', () => {
    const formGroup = new FormGroup({
      password: new FormControl('password123'),
      confirmPassword: new FormControl('password123')
    });
    // First, set the error
    formGroup.get('confirmPassword')?.setErrors({ passwordMismatch: true });
    validator(formGroup);
    expect(formGroup.get('confirmPassword')?.hasError('passwordMismatch')).toBe(false);
  });

  it('should return null if controls are not found', () => {
    const formGroup = new FormGroup({});
    expect(validator(formGroup)).toBeNull();
  });
});
