import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '@shared/db/supabase.service';
import { AuthService } from '@shared/services/auth.service';

export interface RegistrationCredentials {
  email: string;
  password: string;
}

export interface RegistrationResult {
  success: boolean;
  error?: string;
}

interface ErrorWithMessage {
  message?: string;
}

@Injectable({
  providedIn: 'root'
})
export class RegisterService {
  private supabaseService = inject(SupabaseService);
  private authService = inject(AuthService);

  /**
   * Register a new user and automatically sign them in
   * @param credentials User registration credentials
   * @returns Promise with registration result
   */
  async registerAndSignIn(credentials: RegistrationCredentials): Promise<RegistrationResult> {
    try {
      // Step 1: Register the user
      const { error: signUpError } = await this.supabaseService.client.auth.signUp(credentials);

      if (signUpError) {
        return {
          success: false,
          error: signUpError.message
        };
      }

      // Step 2: Sign in the user
      try {
        await this.authService.login({
          email: credentials.email,
          password: credentials.password
        });

        return {
          success: true
        };
      } catch (signInError: unknown) {
        const error = signInError as ErrorWithMessage;
        return {
          success: false,
          error: error.message || 'Registration successful but sign-in failed'
        };
      }
    } catch (error: unknown) {
      const err = error as ErrorWithMessage;
      return {
        success: false,
        error: err.message || 'Registration failed due to a network error'
      };
    }
  }
}
