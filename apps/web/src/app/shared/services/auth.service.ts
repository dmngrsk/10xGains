import { Injectable, inject, Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Observable, from, of, concat, OperatorFunction } from 'rxjs';
import { catchError, map, shareReplay, switchMap } from 'rxjs/operators';
import { AuthError, AuthSession, AuthResponse as SupabaseAuthResponse, User, UserIdentity } from '@supabase/supabase-js';
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
   * Starts the Google OAuth sign-in flow by redirecting the browser to Google.
   * A successful response only means the redirect started; the real outcome
   * arrives at the `/auth/callback?type=oauth` route after the OAuth dance.
   * @returns An `Observable<LoginResponse>` that emits an object indicating success or failure of initiating the flow.
   */
  loginWithGoogle(): Observable<LoginResponse> {
    const options = { redirectTo: `${window.location.origin}/auth/callback?type=oauth` };
    return from(this.supabase.auth.signInWithOAuth({ provider: 'google', options })).pipe(this.toAuthResponse());
  }

  /**
   * Links a Google identity to the currently authenticated user by redirecting the browser to Google.
   * Requires an active session; the identity is attached to the current user instead of creating a new one.
   * The real outcome arrives at the `/auth/callback?type=oauth-link` route after the OAuth dance.
   * @returns An `Observable<AuthResponse>` that emits an object indicating success or failure of initiating the flow.
   */
  linkGoogleIdentity(): Observable<AuthResponse> {
    const options = { redirectTo: `${window.location.origin}/auth/callback?type=oauth-link` };
    return from(this.supabase.auth.linkIdentity({ provider: 'google', options })).pipe(this.toAuthResponse());
  }

  /**
   * Unlinks the Google identity from the currently authenticated user.
   * @returns An `Observable<AuthResponse>` that emits an object indicating success or failure.
   * Fails when no Google identity is linked to the current user.
   */
  unlinkGoogleIdentity(): Observable<AuthResponse> {
    return from(this.supabase.auth.getUserIdentities()).pipe(
      switchMap(({ data, error }) => {
        if (error) {
          return of({ success: false, error: this.toFriendlyError(error.message) });
        }

        const googleIdentity = data?.identities.find(identity => identity.provider === 'google');
        if (!googleIdentity) {
          return of({ success: false, error: 'No Google account is linked.' });
        }

        return from(this.supabase.auth.unlinkIdentity(googleIdentity)).pipe(this.toAuthResponse());
      }),
      catchError((error: Error) => of({ success: false, error: this.toFriendlyError(error.message) }))
    );
  }

  /**
   * Retrieves the identities (sign-in methods) linked to the currently authenticated user.
   * @returns An `Observable<UserIdentity[]>` that emits the user's identities.
   * Errors when the identities cannot be retrieved, so callers can distinguish a genuine
   * "no identities" result from a transient failure instead of treating both as empty.
   */
  getIdentities(): Observable<UserIdentity[]> {
    return from(this.supabase.auth.getUserIdentities()).pipe(
      map(({ data, error }) => {
        if (error) {
          throw new Error(error.message);
        }
        return data?.identities ?? [];
      })
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
   *
   * Reads the locally stored session rather than calling `getUser()`, which asks the Auth server on
   * every invocation. The route guard runs this on every navigation into a guarded area, so that
   * put a network round-trip in front of each one and made the app unusable offline even with a
   * valid, unexpired session. `getSession()` is local and refreshes the token itself when it is
   * close to expiring, and nothing here depends on the server's answer being authoritative - the
   * API verifies the JWT on every request regardless, which is where access is actually decided.
   *
   * @returns An `Observable<boolean>` that emits `true` if a user is authenticated, otherwise `false`.
   */
  isAuthenticated(): Observable<AuthenticationStatusResponse> {
    return from(this.supabase.auth.getSession()).pipe(
      map(({ data }) => ({ isAuthenticated: !!data.session?.user, userId: data.session?.user?.id }))
    );
  }

  /**
   * Rewrites the Supabase auth errors users actually hit into copy written for them.
   *
   * Supabase's messages are written for developers - "Invalid login credentials" does not tell
   * someone which of the two was wrong or what to do next, and the rate-limit message leaks its
   * internal phrasing. Anything unrecognised falls through unchanged, so a new or unusual failure
   * still says something rather than being flattened into a generic apology.
   *
   * @param message The message Supabase returned.
   * @returns The message to show the user.
   */
  private toFriendlyError(message: string): string {
    const friendlyMessages: [RegExp, string][] = [
      [/invalid login credentials/i, 'That email and password do not match an account. Please check both and try again.'],
      [/email not confirmed/i, 'Please confirm your email address first - check your inbox for the verification link.'],
      [/user already registered|already been registered/i, 'An account with this email already exists. Try signing in instead.'],
      [/password should be at least/i, 'Please choose a longer password - it must be at least 6 characters.'],
      [/new password should be different/i, 'Your new password must be different from your current one.'],
      [/unable to validate email address/i, 'That email address does not look valid. Please check it and try again.'],
      [/for security purposes.*after (\d+) seconds?/i, 'Too many attempts just now. Please wait a moment and try again.'],
      [/email rate limit exceeded|over_email_send_rate_limit/i, 'Too many emails requested. Please wait a few minutes before trying again.'],
      [/failed to fetch|network ?error/i, 'Could not reach the server. Please check your connection and try again.'],
    ];

    return friendlyMessages.find(([pattern]) => pattern.test(message))?.[1] ?? message;
  }

  private mapSupabaseResponse<T, R extends AuthResponse>(mapper: (value: T) => R): OperatorFunction<T, R> {
    return (source: Observable<T>) => source.pipe(
      map(mapper),
      catchError((error: Error) => of({ success: false, error: this.toFriendlyError(error.message) } as R)));
  }

  private toAuthResponse(): OperatorFunction<{ error: AuthError | null }, AuthResponse> {
    return this.mapSupabaseResponse(({ error }) => {
      if (error) {
        return { success: false, error: this.toFriendlyError(error.message) };
      }
      return { success: true };
    });
  }

  private toRegisterResponse(): OperatorFunction<SupabaseAuthResponse, RegisterResponse> {
    return this.mapSupabaseResponse(({ data, error }) => {
      if (error) {
        return { success: false, error: this.toFriendlyError(error.message) };
      }
      if (!data.user) {
        return { success: false, error: 'Registration failed - no user data returned' };
      }

      const emailVerified = data.user.identities?.some(i => i.provider === 'email' && i.identity_data?.['email_verified']) ?? false;

      return { success: true, userId: data.user.id, emailVerified };
    });
  }
}
