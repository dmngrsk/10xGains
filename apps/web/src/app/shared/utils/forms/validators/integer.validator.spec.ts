import { FormControl } from '@angular/forms';
import { describe, it, expect } from 'vitest';
import { integerValidator } from './integer.validator';

describe('integerValidator', () => {
  const validator = integerValidator();
  let control: FormControl;

  it('should return null for valid integers', () => {
    const validValues = ['123', '-45', '0', '9876543210'];
    validValues.forEach(value => {
      control = new FormControl(value);
      expect(validator(control)).toBeNull();
    });
  });

  it('should return an error object for non-integer numeric values', () => {
    const invalidValues = ['12.34', '-5.6'];
    invalidValues.forEach(value => {
      control = new FormControl(value);
      expect(validator(control)).toEqual({ integer: { value: value } });
    });
  });

  it('should return an error object for non-numeric values', () => {
    const invalidValues = ['abc', '12a', '1 23', '--5'];
    invalidValues.forEach(value => {
      control = new FormControl(value);
      expect(validator(control)).toEqual({ integer: { value: value } });
    });
  });

  it('should return null for empty or null values', () => {
    const emptyValues = [null, undefined, ''];
    emptyValues.forEach(value => {
      control = new FormControl(value);
      expect(validator(control)).toBeNull();
    });
  });
});
