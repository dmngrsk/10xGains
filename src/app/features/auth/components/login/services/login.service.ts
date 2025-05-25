import { Injectable, inject } from '@angular/core';
import { BehaviorSubject , firstValueFrom } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { AuthService, LoginRequest } from '@shared/services/auth.service';

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
  if (error?.message) {
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

  if (error?.code === 'NETWORK_ERROR' || error?.name === 'TimeoutError') {
    return 'Connection error. Please try again later.';
  }

  if (error?.status) {
    if (error.status === 429) {
      return 'Too many requests. Please try again later.';
    }
    if (error.status >= 500) {
      return 'Server error. Please try again later.';
    }
  }

  return 'An error occurred. Please try again later.';
};

/**
 * Login service responsible for authentication state management
 */
@Injectable({
  providedIn: 'root'
})
export class LoginService {
  private authService = inject(AuthService);

  private isLoadingSubject = new BehaviorSubject<boolean>(false);
  public isLoading$ = this.isLoadingSubject.asObservable();

  /**
   * Logs user in with provided credentials
   * @param credentials User login credentials
   * @returns Promise that resolves when login completes
   * @throws Error with mapped user-friendly message
   */
  async login(credentials: LoginRequest): Promise<void> {
    if (!credentials.email || !credentials.password) {
      throw new Error('Email and password are required.');
    }

    try {
      this.isLoadingSubject.next(true);
      await this.authService.login(credentials);
    } catch (error) {
      console.error('Login error:', error);
      throw new Error(mapError(error as AuthError));
    } finally {
      this.isLoadingSubject.next(false);
    }
  }

  /**
   * Checks if the user is currently authenticated
   * @returns Promise that resolves to a boolean indicating authentication status
   */
  async isAuthenticated(): Promise<boolean> {
    this.isLoadingSubject.next(true);

    try {
      return await firstValueFrom(
        this.authService.isAuthenticated().pipe(
          finalize(() => this.isLoadingSubject.next(false))
        )
      );
    } catch (error) {
      console.error('Error checking authentication status:', error);
      return false;
    } finally {
      this.isLoadingSubject.next(false);
    }
  }
}
