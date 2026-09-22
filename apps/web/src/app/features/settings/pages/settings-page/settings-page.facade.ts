import { Injectable, inject, signal } from '@angular/core';
import { EMPTY, Observable, catchError, finalize, map, switchMap, tap, first, of, from } from 'rxjs';
import { MeasurementType, ProfileDto, UpsertProfileCommand } from '@txg/shared';
import { MeasurementsService } from '@features/measurements/api/measurements.service';
import { ProfileService } from '@shared/api/profile.service';
import { AuthService } from '@shared/services/auth.service';
import { MeasurementsSettingsSaved } from './components/measurements-settings-card/measurements-settings-card.component';
import { SettingsPageViewModel } from '../../models/settings-page.viewmodel';

const initialSettingsPageViewModel: SettingsPageViewModel = {
  profile: {
    firstName: null,
    email: null,
  },
  account: {
    googleLinked: null,
    identityCount: 0,
  },
  measurements: {
    heightCm: null,
    dateOfBirth: null,
    bodyFatMethod: null,
    sex: null,
    frequencyDays: null,
    trackedTypes: null,
    loggedTypes: [],
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
  private readonly measurementsService = inject(MeasurementsService);

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
          switchMap(profile => this.loggedTypesFor(profile).pipe(
            map(loggedTypes => ({ profile, loggedTypes }))
          )),
        ).pipe(
          tap(({ profile, loggedTypes }) => {
            if (profile) {
              this.viewModel.update(vm => ({
                ...vm,
                isLoading: false,
                profile: {
                  firstName: profile.first_name,
                  email: user.email ?? null,
                },
                measurements: {
                  heightCm: profile.height_cm,
                  dateOfBirth: profile.date_of_birth,
                  bodyFatMethod: profile.body_fat_method,
                  sex: profile.sex,
                  frequencyDays: profile.measurement_frequency_days,
                  trackedTypes: profile.tracked_measurement_types as MeasurementType[] | null,
                  loggedTypes,
                },
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

  saveMeasurementSettings(settings: MeasurementsSettingsSaved): Observable<boolean> {
    const currentUser = this.authService.currentUser();
    this.viewModel.update(s => ({ ...s, isLoading: true, error: null }));

    const command: UpsertProfileCommand = {
      date_of_birth: settings.dateOfBirth,
      height_cm: settings.heightCm,
      body_fat_method: settings.bodyFatMethod,
      sex: settings.sex,
      measurement_frequency_days: settings.frequencyDays,
      tracked_measurement_types: settings.trackedTypes,
    };

    return this.profileService.upsertProfile(currentUser!.id, command).pipe(
      tap(() => {
        this.viewModel.update(vm => ({
          ...vm,
          isLoading: false,
          measurements: {
            heightCm: settings.heightCm,
            dateOfBirth: settings.dateOfBirth,
            bodyFatMethod: settings.bodyFatMethod,
            sex: settings.sex,
            frequencyDays: settings.frequencyDays,
            trackedTypes: settings.trackedTypes,
            loggedTypes: vm.measurements.loggedTypes,
          },
        }));
      }),
      map(() => true),
      catchError(err => {
        this.viewModel.update(s => ({ ...s, isLoading: false, error: err.message || 'Failed to save measurement settings.' }));
        return of(false);
      })
    );
  }

  private loggedTypesFor(profile: ProfileDto | null): Observable<MeasurementType[]> {
    const tracked = profile?.tracked_measurement_types;
    if (tracked && tracked.length > 0) {
      return of([] as MeasurementType[]);
    }

    return this.measurementsService.getAllMeasurements().pipe(
      map(response => [...new Set((response.data ?? []).map(row => row.type))])
    );
  }
}
