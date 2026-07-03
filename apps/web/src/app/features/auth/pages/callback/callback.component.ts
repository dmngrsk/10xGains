import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, take } from 'rxjs';
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
        } else {
          this.snackBar.open('Invalid callback type.', 'Close', { duration: 5000 });
          this.router.navigate(['/auth/login']);
        }
      });
  }
}
