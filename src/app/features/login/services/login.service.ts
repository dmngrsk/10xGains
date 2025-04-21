import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { firstValueFrom } from 'rxjs';
import { AuthService, LoginRequest } from '../../../shared/services/auth.service';

/**
 * Type for authentication errors
 */
interface AuthError {
  message?: string;
  code?: string;
  name?: string;
  status?: number;
}

/**
 * Maps authentication errors to user-friendly messages
 * @param error The error object from the authentication service
 * @returns A user-friendly error message
 */
const mapError = (error: AuthError): string => {
  // Check if it's an authentication error with a message
  if (error?.message) {
    // Supabase specific error messages
    if (error.message.includes('Invalid login credentials')) {
      return 'Invalid email or password.';
    }
    if (error.message.includes('Email not confirmed')) {
      return 'Email not confirmed. Please check your inbox.';
    }
    if (error.message.includes('User not found')) {
      return 'No account found with this email.';
    }
    if (error.message.includes('Invalid email')) {
      return 'Please enter a valid email address.';
    }
    if (error.message.includes('rate limit')) {
      return 'Too many login attempts. Please try again later.';
    }
  }

  // Network or timeout errors
  if (error?.code === 'NETWORK_ERROR' || error?.name === 'TimeoutError') {
    return 'Connection error. Please try again later.';
  }

  // HTTP Status codes
  if (error?.status) {
    if (error.status === 429) {
      return 'Too many requests. Please try again later.';
    }
    if (error.status >= 500) {
      return 'Server error. Please try again later.';
    }
  }

  // Default error message for any other errors
  return 'An error occurred. Please try again later.';
};

/**
 * Login service responsible for authentication state management
 * and navigation after successful login
 */
@Injectable({
  providedIn: 'root'
})
export class LoginService {
  private authService = inject(AuthService);
  private router = inject(Router);

  private isLoadingSubject = new BehaviorSubject<boolean>(false);
  public isLoading$ = this.isLoadingSubject.asObservable();

  /**
   * Logs user in and redirects to appropriate page based on authentication status
   * @param credentials User login credentials
   * @returns Promise that resolves when login completes
   * @throws Error with mapped user-friendly message
   */
  async login(credentials: LoginRequest): Promise<void> {
    // Validate inputs before even trying
    if (!credentials.email || !credentials.password) {
      throw new Error('Email and password are required.');
    }

    try {
      this.isLoadingSubject.next(true);
      await this.authService.login(credentials);

      // Success - navigate to home page
      await this.router.navigate(['/home']);
    } catch (error) {
      console.error('Login error:', error);
      // Map the error to a user-friendly message and re-throw
      throw new Error(mapError(error as AuthError));
    } finally {
      this.isLoadingSubject.next(false);
    }
  }

  /**
   * Redirects user to appropriate route based on authentication status
   * If user is authenticated, redirects to home
   * If not authenticated, stays on current page
   */
  async redirectIfAuthenticated(): Promise<void> {
    this.isLoadingSubject.next(true);

    try {
      const isAuthenticated = await firstValueFrom(
        this.authService.isAuthenticated().pipe(
          finalize(() => this.isLoadingSubject.next(false))
        )
      );

      if (isAuthenticated) {
        await this.router.navigate(['/home']);
      }
    } catch (error) {
      console.error('Error checking authentication status:', error);
    } finally {
      this.isLoadingSubject.next(false);
    }
  }
}
