import { Injectable, inject, Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Observable, from, of, concat, OperatorFunction } from 'rxjs';
import { catchError, map, shareReplay } from 'rxjs/operators';
import { AuthError, AuthSession, AuthResponse as SupabaseAuthResponse, User } from '@supabase/supabase-js';
import { ProfileService } from '@shared/api/profile.service';
import { tapIf } from '@shared/utils/operators/tap-if.operator';
import { SupabaseService } from '../db/supabase.service';

export interface AuthCommand {
  email: string;
  password: string;
}

export interface AuthResponse {
  success: boolean;
  error?: string;
}

export type LoginCommand = AuthCommand;
export type LoginResponse = AuthResponse;

export type LogoutResponse = AuthResponse;

export type RegisterCommand = AuthCommand;
export type RegisterResponse = AuthResponse & { userId?: string; emailVerified?: boolean; };

export type ResetPasswordCommand = Pick<AuthCommand, 'email'>;
export type ResetPasswordResponse = AuthResponse;

export type ChangePasswordCommand = Pick<AuthCommand, 'password'>;
export type ChangePasswordResponse = AuthResponse;

export type AuthenticationStatusResponse = { isAuthenticated: boolean; userId?: string; };

/**
 * Provides authentication-related functionalities by wrapping the Supabase client.
 */
@Injectable({
  providedIn: 'root'
})
export class AuthService {
  readonly supabase = inject(SupabaseService).client;
  private readonly profileService = inject(ProfileService);

  /**
   * An observable that emits the currently authenticated user object, or `null` if unauthenticated.
   */
  readonly currentUser$: Observable<User | null>;

  /**
   * A signal that holds the currently authenticated user object, or `null` if unauthenticated.
   */
  readonly currentUser: Signal<User | null>;

  constructor() {
    this.currentUser$ = concat(
      from(this.supabase.auth.getSession()).pipe(map(({ data }) => data.session)),
      new Observable<AuthSession | null>(observer => {
        const {
          data: { subscription }
        } = this.supabase.auth.onAuthStateChange((_event, session) => {
          observer.next(session);
        });

        return () => {
          subscription.unsubscribe();
        };
      })
    ).pipe(
      map(session => session?.user ?? null),
      shareReplay(1)
    );

    this.currentUser = toSignal(this.currentUser$, { initialValue: null });
  }

  /**
   * Signs in a user with their email and password.
   * @param command The login command containing email and password.
   * @returns An `Observable<LoginResponse>` that emits an object indicating success or failure.
   */
  login(command: LoginCommand): Observable<LoginResponse> {
    return from(this.supabase.auth.signInWithPassword(command)).pipe(this.toAuthResponse());
  }

  /**
   * Signs out the currently authenticated user.
   * @returns An `Observable<LogoutResponse>` that emits an object indicating success or failure.
   */
  logout(): Observable<LogoutResponse> {
    return from(this.supabase.auth.signOut()).pipe(this.toAuthResponse());
  }

  /**
   * Registers a new user with their email and password.
   * @param command The registration command containing email and password.
   * @returns An `Observable<RegisterResponse>` that emits an object indicating success, whether the email is verified after registration, or failure.
   * As a side effect, a user profile is created for the freshly registered user in the `public.profiles` table if the email is verified.
   */
  register(command: RegisterCommand): Observable<RegisterResponse> {
    const options = { emailRedirectTo: `${window.location.origin}/auth/callback?type=register` };
    return from(this.supabase.auth.signUp({ ...command, options })).pipe(
      this.toRegisterResponse(),
      tapIf(r => (r.success && r.emailVerified) ?? false, (r) => this.profileService.createDefaultProfile(r.userId!))
    );
  }

  /**
   * Sends a password reset link to the user's email.
   * @param command The command containing the user's email.
   * @returns An `Observable<ResetPasswordResponse>` that emits an object indicating success or failure.
   */
  resetPassword(command: ResetPasswordCommand): Observable<ResetPasswordResponse> {
    const options = { redirectTo: `${window.location.origin}/auth/callback?type=reset-password` };
    return from(this.supabase.auth.resetPasswordForEmail(command.email, options )).pipe(this.toAuthResponse());
  }

  /**
   * Updates the password for the currently authenticated user.
   * @param command The command containing the new password.
   * @returns An `Observable<ChangePasswordResponse>` that emits an object indicating success or failure.
   */
  changePassword(command: ChangePasswordCommand): Observable<ChangePasswordResponse> {
    return from(this.supabase.auth.updateUser(command)).pipe(this.toAuthResponse());
  }

  /**
   * Checks if a user is currently authenticated.
   * @returns An `Observable<boolean>` that emits `true` if a user is authenticated, otherwise `false`.
   */
  isAuthenticated(): Observable<AuthenticationStatusResponse> {
    return from(this.supabase.auth.getUser()).pipe(map(({ data }) => ({ isAuthenticated: !!data.user, userId: data.user?.id })));
  }

  private mapSupabaseResponse<T, R extends AuthResponse>(mapper: (value: T) => R): OperatorFunction<T, R> {
    return (source: Observable<T>) => source.pipe(
      map(mapper),
      catchError((error: Error) => of({ success: false, error: error.message } as R)));
  }

  private toAuthResponse(): OperatorFunction<{ error: AuthError | null }, AuthResponse> {
    return this.mapSupabaseResponse(({ error }) => {
      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true };
    });
  }

  private toRegisterResponse(): OperatorFunction<SupabaseAuthResponse, RegisterResponse> {
    return this.mapSupabaseResponse(({ data, error }) => {
      if (error) {
        return { success: false, error: error.message };
      }
      if (!data.user) {
        return { success: false, error: 'Registration failed - no user data returned' };
      }

      const emailVerified = data.user.identities?.some(i => i.provider === 'email' && i.identity_data?.['email_verified']) ?? false;

      return { success: true, userId: data.user.id, emailVerified };
    });
  }
}
