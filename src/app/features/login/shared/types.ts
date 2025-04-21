/**
 * Types for login form
 */
import { z } from 'zod';

export interface LoginFormValues {
  email: string;
  password: string;
}

/**
 * Zod schema for login form validation
 */
export const loginFormSchema = z.object({
  email: z.string()
    .min(1, { message: 'Email is required' })
    .email({ message: 'Please enter a valid email address' }),
  password: z.string()
    .min(1, { message: 'Password is required' })
});

/**
 * Type inferred from Zod schema
 */
export type LoginFormSchema = z.infer<typeof loginFormSchema>;
