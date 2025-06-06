import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { filter, take, switchMap } from 'rxjs';
import { UpdateUserProfileCommand } from '@shared/api/api.types';
import { NoticeComponent } from '@shared/ui/components/notice/notice.component';
import { MainLayoutComponent } from '@shared/ui/layouts/main-layout/main-layout.component';
import { tapIf } from '@shared/utils/operators/tap-if.operator';
import { AccountSettingsCardComponent } from './components/account-settings-card/account-settings-card.component';
import { ChangePasswordDialogComponent } from './components/dialogs/change-password-dialog/change-password-dialog.component';
import { ProfileSettingsCardComponent } from './components/profile-settings-card/profile-settings-card.component';
import { SettingsPageFacade } from './settings-page.facade';

@Component({
  selector: 'txg-settings-page',
  standalone: true,
  imports: [
    CommonModule,
    MainLayoutComponent,
    MatDialogModule,
    MatProgressSpinnerModule,
    MatDividerModule,
    ProfileSettingsCardComponent,
    AccountSettingsCardComponent,
    NoticeComponent
  ],
  templateUrl: './settings-page.component.html'
})
export class SettingsPageComponent implements OnInit {
  private readonly facade = inject(SettingsPageFacade);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  readonly viewModel = this.facade.viewModel;
  readonly isLoadingSignal = computed(() => this.facade.viewModel().isLoading);
  readonly initialLoadFinished = signal(false);

  ngOnInit(): void {
    this.facade.loadInitialData();
    this.initialLoadFinished.set(true);
  }

  onProfileSaved(command: UpdateUserProfileCommand | null): void {
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

  onSignedOut(): void {
    this.facade.signOut().pipe(
      take(1),
      tapIf(success => success, () => this.snackBar.open('Signed out successfully.', 'Close', { duration: 3000 })),
      tapIf(success => !success, () => this.snackBar.open('Failed to sign out.', 'Close', { duration: 3000 }))
    ).subscribe();
  }
}
