import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { ZodError, ZodSchema } from 'zod';

interface ValidationError {
  message: string;
  type: string;
}

/**
 * Creates a validator function that validates a form control using a Zod schema
 *
 * @param schema The Zod schema to validate against
 * @returns A validator function that returns validation errors or null
 */
export function zodValidator<T>(schema: ZodSchema<T>): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    try {
      schema.parse(control.value);
      return null;
    } catch (error) {
      if (error instanceof ZodError) {
        const formattedErrors: ValidationErrors = {};

        error.errors.forEach((err) => {
          const path = err.path.join('.');
          formattedErrors[path || 'value'] = {
            message: err.message,
            type: err.code
          };
        });

        return formattedErrors;
      }

      return { zodValidation: 'Failed to validate form data' };
    }
  };
}

/**
 * Creates a validator function that validates a form group using a Zod schema
 *
 * @param schema The Zod schema to validate against
 * @returns A validator function that returns validation errors or null
 */
export function zodFormGroupValidator<T>(schema: ZodSchema<T>): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    try {
      schema.parse(control.value);
      return null;
    } catch (error) {
      if (error instanceof ZodError) {
        const formattedErrors: ValidationErrors = {};

        error.errors.forEach((err) => {
          const fieldName = err.path[0]?.toString() || 'form';
          if (!formattedErrors[fieldName]) {
            formattedErrors[fieldName] = [] as ValidationError[];
          }

          (formattedErrors[fieldName] as ValidationError[]).push({
            message: err.message,
            type: err.code
          });
        });

        return formattedErrors;
      }

      return { zodValidation: 'Failed to validate form data' };
    }
  };
}
