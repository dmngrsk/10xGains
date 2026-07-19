import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, of, take } from 'rxjs';
import { first, switchMap } from 'rxjs/operators';
import { ProfileService } from '@shared/api/profile.service';
import { AuthService } from '@shared/services/auth.service';

@Component({
  selector: 'txg-callback',
  standalone: true,
  template: '',
  imports: [],
})
export class CallbackComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  private readonly authService = inject(AuthService);
  private readonly profileService = inject(ProfileService);

  ngOnInit() {
    forkJoin({
      auth: this.authService.isAuthenticated(),
      params: this.route.queryParams.pipe(take(1)),
    }).pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ auth, params }) => {
        const type = params['type'];
        if (type === 'register') {
          this.profileService.createDefaultProfile(auth.userId!).subscribe(() => {
            this.snackBar.open('Verification successful! Welcome to 10xGains.', 'Close', { duration: 5000 });
            this.router.navigate(['/auth/login']);
          });
        } else if (type === 'reset-password') {
          this.router.navigate(['/settings'], { state: { action: 'changePassword' } });
        } else if (type === 'oauth' || type === 'oauth-link') {
          // An abandoned or failed OAuth dance still lands here, just without a session.
          if (!auth.isAuthenticated) {
            this.snackBar.open('Google sign-in was not completed. Please try again.', 'Close', { duration: 5000 });
            this.router.navigate(['/auth/login']);
            return;
          }

          if (type === 'oauth-link') {
            this.snackBar.open('Google account connected.', 'Close', { duration: 5000 });
            this.router.navigate(['/settings']);
            return;
          }

          // New OAuth users have no profile yet: seed first_name from Google's name. Existing
          // (auto-linked) users keep their profile, so re-running the callback never clobbers it.
          this.profileService.getProfile(auth.userId!).pipe(
            switchMap(response => {
              if (response.data) {
                return of(null);
              }

              return this.authService.currentUser$.pipe(
                first(user => user !== null),
                switchMap(user => {
                  const metadata = (user?.user_metadata ?? {}) as { given_name?: string; name?: string };
                  return this.profileService.upsertProfile(auth.userId!, { first_name: metadata.given_name ?? metadata.name ?? '' });
                })
              );
            })
          ).subscribe({
            next: () => this.router.navigate(['/home']),
            error: () => {
              this.snackBar.open('Google sign-in finished, but we could not set up your profile. Please try again.', 'Close', { duration: 5000 });
              this.router.navigate(['/home']);
            }
          });
        } else {
          this.snackBar.open('Invalid callback type.', 'Close', { duration: 5000 });
          this.router.navigate(['/auth/login']);
        }
      });
  }
}
