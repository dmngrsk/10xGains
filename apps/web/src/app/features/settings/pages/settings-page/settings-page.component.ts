import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, Router } from '@angular/router';
import { filter, take, switchMap } from 'rxjs';
import { UpsertProfileCommand } from '@txg/shared';
import { SettingsViewMode } from '@features/settings/models/settings-page.viewmodel';
import { LocalStorageService } from '@shared/services/local-storage.service';
import { NoticeComponent } from '@shared/ui/components/notice/notice.component';
import { MainLayoutComponent } from '@shared/ui/layouts/main-layout/main-layout.component';
import { tapIf } from '@shared/utils/operators/tap-if.operator';
import { AccountSettingsCardComponent } from './components/account-settings-card/account-settings-card.component';
import { ChangePasswordDialogComponent } from './components/dialogs/change-password-dialog/change-password-dialog.component';
import { ProfileSettingsCardComponent } from './components/profile-settings-card/profile-settings-card.component';
import { SessionSettingsCardComponent } from './components/session-settings-card/session-settings-card.component';
import { SettingsTabsComponent } from './components/settings-tabs/settings-tabs.component';
import { SettingsPageFacade } from './settings-page.facade';

const VIEW_MODE_STORAGE_KEY = 'txg.settings.view-mode';
const VIEW_MODES: SettingsViewMode[] = ['workout', 'user'];

@Component({
  selector: 'txg-settings-page',
  standalone: true,
  imports: [
    CommonModule,
    MainLayoutComponent,
    MatDialogModule,
    MatProgressSpinnerModule,
    MatDividerModule,
    MatIconModule,
    SettingsTabsComponent,
    SessionSettingsCardComponent,
    ProfileSettingsCardComponent,
    AccountSettingsCardComponent,
    NoticeComponent
  ],
  templateUrl: './settings-page.component.html',
  styleUrl: './settings-page.component.scss',
})
export class SettingsPageComponent implements OnInit {
  private readonly facade = inject(SettingsPageFacade);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly localStorage = inject(LocalStorageService);

  readonly viewModel = this.facade.viewModel;
  readonly isLoadingSignal = computed(() => this.facade.viewModel().isLoading);
  readonly initialLoadFinished = signal(false);
  readonly viewMode = signal<SettingsViewMode>('workout');

  ngOnInit(): void {
    const isChangingPassword = history.state?.action === 'changePassword';
    this.viewMode.set(isChangingPassword ? 'user' : this.resolveViewMode());
    this.syncViewQueryParams();

    this.facade.loadInitialData();
    this.initialLoadFinished.set(true);

    if (isChangingPassword) {
      const { action: _, ...stateWithoutAction } = history.state;
      history.replaceState(stateWithoutAction, '');
      this.onPasswordChanged();
    }
  }

  onViewModeChanged(mode: SettingsViewMode): void {
    this.viewMode.set(mode);
    this.localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode);
    this.syncViewQueryParams();
  }

  onProfileSaved(command: UpsertProfileCommand | null): void {
    this.facade.saveProfile(command!).pipe(
      take(1),
      tapIf(success => success, () => this.snackBar.open('Profile updated successfully.', 'Close', { duration: 3000 })),
      tapIf(success => !success, () => this.snackBar.open('Failed to update profile. Please try again.', 'Close', { duration: 3000 }))
    ).subscribe();
  }

  onPasswordChanged(): void {
    this.dialog
      .open(ChangePasswordDialogComponent, { width: '400px', disableClose: true })
      .afterClosed()
      .pipe(
        filter((result): result is string => !!result),
        take(1),
        switchMap(result =>
          this.facade.changePassword(result).pipe(
            take(1),
            tapIf(success => success, () => this.snackBar.open('Password changed successfully.', 'Close', { duration: 3000 })),
            tapIf(success => !success, () => this.snackBar.open('Failed to change password.', 'Close', { duration: 3000 }))
          )
        )
      )
      .subscribe();
  }

  onGoogleConnected(): void {
    this.facade.connectGoogle().pipe(
      take(1),
      tapIf(success => !success, () => this.snackBar.open('Failed to connect Google account.', 'Close', { duration: 3000 }))
    ).subscribe();
  }

  onGoogleDisconnected(): void {
    this.facade.disconnectGoogle().pipe(
      take(1),
      tapIf(success => success, () => this.snackBar.open('Google account disconnected.', 'Close', { duration: 3000 })),
      tapIf(success => !success, () => this.snackBar.open('Failed to disconnect Google account.', 'Close', { duration: 3000 }))
    ).subscribe();
  }

  onSignedOut(): void {
    this.facade.signOut().pipe(
      take(1),
      tapIf(success => success, () => {
        this.snackBar.open('Signed out successfully.', 'Close', { duration: 3000 });
        this.router.navigate(['/auth']);
      }),
      tapIf(success => !success, () => this.snackBar.open('Failed to sign out.', 'Close', { duration: 3000 }))
    ).subscribe();
  }

  private resolveViewMode(): SettingsViewMode {
    const candidates = [this.route.snapshot.queryParamMap.get('view'), this.localStorage.getItem(VIEW_MODE_STORAGE_KEY)];
    return candidates.find((candidate): candidate is SettingsViewMode => VIEW_MODES.includes(candidate as SettingsViewMode)) ?? 'workout';
  }

  private syncViewQueryParams(): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { view: this.viewMode() },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}
