import { AbstractControl, FormGroup, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * A validator factory that creates a validator to check if a start date is not after an end date.
 * The error 'dateRangeInvalid' is set on the start date control if the validation fails.
 *
 * @param dateFromKey The form control name for the start date.
 * @param dateToKey The form control name for the end date.
 * @returns A ValidatorFn that always returns null, errors are set on the child control.
 */
export function dateRangeValidator(dateFromKey: string, dateToKey: string): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    if (!(group instanceof FormGroup)) {
      return null; // Should be applied to a FormGroup
    }

    const dateFromCtrl = group.controls[dateFromKey];
    const dateToCtrl = group.controls[dateToKey];

    if (!dateFromCtrl || !dateToCtrl) {
      // If controls are not found, skip validation
      return null;
    }

    const dateFrom = dateFromCtrl.value;
    const dateTo = dateToCtrl.value;

    const dateFromErrors = dateFromCtrl.errors ? { ...dateFromCtrl.errors } : {};

    // Condition for setting the error
    const isInvalid = dateFrom && dateTo && new Date(dateFrom) > new Date(dateTo);

    if (isInvalid) {
      dateFromErrors['dateRangeInvalid'] = true;
      dateFromCtrl.setErrors(dateFromErrors, { emitEvent: false });
    } else {
      // If the specific error exists, remove it
      if (dateFromErrors['dateRangeInvalid']) {
        delete dateFromErrors['dateRangeInvalid'];
        if (Object.keys(dateFromErrors).length === 0) {
          dateFromCtrl.setErrors(null, { emitEvent: false });
        } else {
          dateFromCtrl.setErrors(dateFromErrors, { emitEvent: false });
        }
      }
    }

    // Always ensure the 'dateTo' control doesn't carry this specific error
    // as it's primarily an error for 'dateFrom' in this setup.
    if (dateToCtrl.errors && dateToCtrl.errors['dateRangeInvalid']) {
      const dateToErrors = { ...dateToCtrl.errors };
      delete dateToErrors['dateRangeInvalid'];
      if (Object.keys(dateToErrors).length === 0) {
        dateToCtrl.setErrors(null, { emitEvent: false });
      } else {
        dateToCtrl.setErrors(dateToErrors, { emitEvent: false });
      }
    }

    return null; // The validator function for the group returns null, errors are set on the child control.
  };
}
