import { z } from 'zod';

/**
 * Auth request models
 */
export interface AuthRequest {
  email: string;
  password: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

/**
 * Auth response models
 */
export interface ErrorResponse {
  message: string;
  code?: string;
}

/**
 * Form models
 */
export interface LoginFormValues {
  email: string;
  password: string;
}

export interface RegisterFormValues {
  email: string;
  password: string;
  confirmPassword: string;
}

export interface ForgotPasswordFormValues {
  email: string;
}

export interface ResetPasswordFormValues {
  password: string;
  confirmPassword: string;
}

/**
 * Validation schemas
 */
export const loginFormSchema = z.object({
  email: z.string()
    .min(1, { message: 'Email is required' })
    .email({ message: 'Please enter a valid email address' }),
  password: z.string()
    .min(1, { message: 'Password is required' })
});

export const registerFormSchema = z.object({
  email: z.string()
    .min(1, { message: 'Email is required' })
    .email({ message: 'Please enter a valid email address' }),
  password: z.string()
    .min(8, { message: 'Password must be at least 8 characters' }),
  confirmPassword: z.string()
    .min(1, { message: 'Please confirm your password' })
}).refine(data => data.password === data.confirmPassword, {
  message: 'Passwords must match',
  path: ['confirmPassword']
});

export const forgotPasswordFormSchema = z.object({
  email: z.string()
    .min(1, { message: 'Email is required' })
    .email({ message: 'Please enter a valid email address' })
});

export const resetPasswordFormSchema = z.object({
  password: z.string()
    .min(8, { message: 'Password must be at least 8 characters' }),
  confirmPassword: z.string()
    .min(1, { message: 'Please confirm your password' })
}).refine(data => data.password === data.confirmPassword, {
  message: 'Passwords must match',
  path: ['confirmPassword']
});
