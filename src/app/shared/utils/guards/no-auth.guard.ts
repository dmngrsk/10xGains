import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { filter, map, switchMap, take } from 'rxjs/operators';
import { AuthService } from '../../services/auth.service';

export const noAuthGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return authService.authStateInitialized$.pipe(
    filter(initialized => initialized),
    take(1),
    switchMap(() => authService.isAuthenticated()),
    map(isAuthenticated => {
      if (!isAuthenticated) {
        return true;
      } else {
        router.navigate(['/home']);
        return false;
      }
    })
  );
};
