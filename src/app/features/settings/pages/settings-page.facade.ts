import { Injectable, inject, signal } from '@angular/core';
import { EMPTY, Observable, catchError, finalize, map, switchMap, tap, first, of, from } from 'rxjs';
import { UpdateUserProfileCommand } from '@shared/api/api.types';
import { ProfileService } from '@shared/api/profile.service';
import { AuthService } from '@shared/services/auth.service';
import { SettingsPageViewModel } from '../models/settings-page.viewmodel';

const initialSettingsPageViewModel: SettingsPageViewModel = {
  profile: {
    firstName: null,
    email: null,
    aiSuggestionsRemaining: null,
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

    this.authService.currentUser$.pipe(
      first(user => user !== null),
      switchMap(user => {
        if (!user || !user.id) {
          this.viewModel.update(s => ({ ...s, isLoading: false, error: 'User not found.' }));
          return EMPTY;
        }

        return this.profileService.getUserProfile(user.id).pipe(
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

  saveProfile(command: UpdateUserProfileCommand): Observable<boolean> {
    const currentUser = this.authService.currentUser();
    this.viewModel.update(s => ({ ...s, isLoading: true, error: null }));

    return this.profileService.updateUserProfile(currentUser!.id, command).pipe(
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

    return from(this.authService.changePassword(password)).pipe(
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
