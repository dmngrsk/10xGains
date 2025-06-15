import { FormControl } from '@angular/forms';
import { describe, it, expect } from 'vitest';
import { numericValidator } from './numeric.validator';

describe('numericValidator', () => {
  const validator = numericValidator();
  let control: FormControl;

  it('should return null for valid numeric values (integers and decimals)', () => {
    const validValues = ['123', '-45', '0', '12.34', '-5.6', '.5', '-.5'];
    validValues.forEach(value => {
      control = new FormControl(value);
      expect(validator(control)).toBeNull();
    });
  });

  it('should return an error object for non-numeric values', () => {
    const invalidValues = ['abc', '12a', '1 23', '--5', '1.2.3', '1.'];
    invalidValues.forEach(value => {
      control = new FormControl(value);
      expect(validator(control)).toEqual({ numeric: { value: value } });
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
