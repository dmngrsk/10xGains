import { FormControl, FormGroup } from '@angular/forms';
import { describe, it, expect, beforeEach } from 'vitest';
import { dateRangeValidator } from './date-range.validator';

describe('dateRangeValidator', () => {
  let form: FormGroup;
  const dateFromKey = 'startDate';
  const dateToKey = 'endDate';

  beforeEach(() => {
    form = new FormGroup(
      {
        [dateFromKey]: new FormControl<Date | null>(null),
        [dateToKey]: new FormControl<Date | null>(null),
      },
      { validators: dateRangeValidator(dateFromKey, dateToKey) }
    );
  });

  it('should not set an error if the start date is before the end date', () => {
    form.controls[dateFromKey].setValue(new Date('2023-01-01'));
    form.controls[dateToKey].setValue(new Date('2023-01-02'));
    expect(form.controls[dateFromKey].errors).toBeNull();
  });

  it('should set the "dateRangeInvalid" error on the start date control if the start date is after the end date', () => {
    form.controls[dateFromKey].setValue(new Date('2023-01-02'));
    form.controls[dateToKey].setValue(new Date('2023-01-01'));
    expect(form.controls[dateFromKey].hasError('dateRangeInvalid')).toBe(true);
  });

  it('should not set an error if dates are the same', () => {
    form.controls[dateFromKey].setValue(new Date('2023-01-01'));
    form.controls[dateToKey].setValue(new Date('2023-01-01'));
    expect(form.controls[dateFromKey].errors).toBeNull();
  });

  it('should not set an error if one or both dates are null', () => {
    form.controls[dateFromKey].setValue(null);
    form.controls[dateToKey].setValue(new Date('2023-01-01'));
    expect(form.controls[dateFromKey].errors).toBeNull();

    form.controls[dateFromKey].setValue(new Date('2023-01-01'));
    form.controls[dateToKey].setValue(null);
    expect(form.controls[dateFromKey].errors).toBeNull();

    form.controls[dateFromKey].setValue(null);
    form.controls[dateToKey].setValue(null);
    expect(form.controls[dateFromKey].errors).toBeNull();
  });

  it('should remove the "dateRangeInvalid" error when the date range becomes valid', () => {
    // Start with an invalid range
    form.controls[dateFromKey].setValue(new Date('2023-01-02'));
    form.controls[dateToKey].setValue(new Date('2023-01-01'));
    expect(form.controls[dateFromKey].hasError('dateRangeInvalid')).toBe(true);

    // Correct the range
    form.controls[dateToKey].setValue(new Date('2023-01-03'));
    // Re-trigger validation by updating the other control
    form.controls[dateFromKey].updateValueAndValidity();
    expect(form.controls[dateFromKey].hasError('dateRangeInvalid')).toBe(false);
  });

  it('should preserve existing errors when adding and removing dateRangeInvalid error', () => {
    form.controls[dateFromKey].setValue(new Date('2023-01-02'));
    form.controls[dateToKey].setValue(new Date('2023-01-01'));
    expect(form.controls[dateFromKey].hasError('dateRangeInvalid')).toBe(true);

    const existingErrors = form.controls[dateFromKey].errors ?? {};
    form.controls[dateFromKey].setErrors({ ...existingErrors, required: true });
    expect(form.controls[dateFromKey].hasError('dateRangeInvalid')).toBe(true);
    expect(form.controls[dateFromKey].hasError('required')).toBe(true);

    form.controls[dateToKey].setValue(new Date('2023-01-03'));
    expect(form.controls[dateFromKey].hasError('dateRangeInvalid')).toBe(false);
    expect(form.controls[dateFromKey].hasError('required')).toBe(true);
  });

  it('should handle cases where form controls are missing', () => {
    const invalidForm = new FormGroup(
      {
        wrongKey: new FormControl(),
      },
      { validators: dateRangeValidator(dateFromKey, dateToKey) }
    );

    expect(() => invalidForm.updateValueAndValidity()).not.toThrow();
    expect(invalidForm.errors).toBeNull();
  });

  it('should return null if not applied to a FormGroup', () => {
    const control = new FormControl();
    const validator = dateRangeValidator(dateFromKey, dateToKey);
    const result = validator(control);
    expect(result).toBeNull();
  });
});
