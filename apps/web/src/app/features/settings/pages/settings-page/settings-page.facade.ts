import { Injectable, inject, signal } from '@angular/core';
import { EMPTY, Observable, catchError, finalize, map, switchMap, tap, first, of, from } from 'rxjs';
import { UpsertProfileCommand } from '@txg/shared';
import { ProfileService } from '@shared/api/profile.service';
import { AuthService } from '@shared/services/auth.service';
import { SettingsPageViewModel } from '../../models/settings-page.viewmodel';

const initialSettingsPageViewModel: SettingsPageViewModel = {
  profile: {
    firstName: null,
    email: null,
    aiSuggestionsRemaining: null,
  },
  account: {
    googleLinked: null,
    identityCount: 0,
  },
  isLoading: false,
  error: null,
};

@Injectable({
  providedIn: 'root'
})
export class SettingsPageFacade {
  private readonly authService = inject(AuthService);
  private readonly profileService = inject(ProfileService);

  readonly viewModel = signal<SettingsPageViewModel>(initialSettingsPageViewModel);

  loadInitialData(): void {
    this.viewModel.update(s => ({ ...s, isLoading: true, error: null }));
    this.loadIdentities();

    this.authService.currentUser$.pipe(
      first(user => user !== null),
      switchMap(user => {
        if (!user || !user.id) {
          this.viewModel.update(s => ({ ...s, isLoading: false, error: 'User not found.' }));
          return EMPTY;
        }

        return this.profileService.getProfile(user.id).pipe(
          map(response => response.data),
          tap(profile => {
            if (profile) {
              this.viewModel.update(vm => ({
                ...vm,
                isLoading: false,
                profile: {
                  firstName: profile.first_name,
                  email: user.email ?? null,
                  aiSuggestionsRemaining: profile.ai_suggestions_remaining
                }
              }));
            } else {
              this.viewModel.update(s => ({ ...s, isLoading: false, profile: initialSettingsPageViewModel.profile }));
            }
          }),
          catchError(err => {
            this.viewModel.update(s => ({ ...s, isLoading: false, error: err.message || 'Failed to load profile.' }));
            return EMPTY;
          })
        );
      }),
      catchError(err => {
        this.viewModel.update(s => ({ ...s, isLoading: false, error: err.message || 'Failed to load initial data.' }));
        return EMPTY;
      })
    ).subscribe();
  }

  loadIdentities(): void {
    this.authService.getIdentities().pipe(first()).subscribe({
      next: identities => this.viewModel.update(vm => ({
        ...vm,
        account: {
          googleLinked: identities.some(identity => identity.provider === 'google'),
          identityCount: identities.length,
        }
      })),
      error: () => this.viewModel.update(vm => ({
        ...vm,
        account: { googleLinked: null, identityCount: 0 },
      })),
    });
  }

  connectGoogle(): Observable<boolean> {
    return this.authService.linkGoogleIdentity().pipe(
      map(response => response.success),
      catchError(() => of(false))
    );
  }

  disconnectGoogle(): Observable<boolean> {
    this.viewModel.update(s => ({ ...s, isLoading: true, error: null }));

    // unlinkGoogleIdentity() never errors - it maps failures to { success: false, error } - so a
    // catchError here would be dead code. On success Google is gone, so update the account state
    // locally instead of re-fetching the identities.
    return this.authService.unlinkGoogleIdentity().pipe(
      tap(response => {
        this.viewModel.update(s => ({
          ...s,
          isLoading: false,
          error: response.success ? null : (response.error ?? 'Failed to disconnect Google.'),
          account: response.success
            ? { googleLinked: false, identityCount: Math.max(0, s.account.identityCount - 1) }
            : s.account,
        }));
      }),
      map(response => response.success)
    );
  }

  saveProfile(command: UpsertProfileCommand): Observable<boolean> {
    const currentUser = this.authService.currentUser();
    this.viewModel.update(s => ({ ...s, isLoading: true, error: null }));

    return this.profileService.upsertProfile(currentUser!.id, command).pipe(
      tap(response => {
        this.viewModel.update(vm => ({
          ...vm,
          isLoading: false,
          profile: {
            ...vm.profile,
            firstName: response.data?.first_name ?? vm.profile.firstName,
          }
        }));
      }),
      map(() => true),
      catchError(err => {
        this.viewModel.update(s => ({ ...s, isLoading: false, error: err.message || 'Failed to update profile.' }));
        return of(false);
      }),
      finalize(() => this.viewModel.update(s => ({ ...s, isLoading: false })))
    );
  }

  changePassword(password: string): Observable<boolean> {
    this.viewModel.update(s => ({ ...s, isLoading: true, error: null }));

    return from(this.authService.changePassword({ password })).pipe(
      tap(() => this.viewModel.update(s => ({ ...s, isLoading: false }))),
      map(() => true),
      catchError(err => {
        const errorMessage = err instanceof Error ? err.message : 'Failed to change password.';
        this.viewModel.update(s => ({ ...s, isLoading: false, error: errorMessage }));
        return of(false);
      })
    );
  }

  signOut(): Observable<boolean> {
    this.viewModel.update(s => ({ ...s, isLoading: true, error: null }));

    return from(this.authService.logout()).pipe(
      tap(() => this.viewModel.update(s => ({ ...s, isLoading: false }))),
      map(() => true),
      catchError(err => {
        const errorMessage = err instanceof Error ? err.message : 'Logout failed.';
        this.viewModel.update(s => ({ ...s, isLoading: false, error: errorMessage }));
        return of(false);
      })
    );
  }
}
