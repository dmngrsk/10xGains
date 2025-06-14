import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs/operators';
import { AuthService } from '../../services/auth.service';
import { tapIf } from '../operators/tap-if.operator';

export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return authService.isAuthenticated().pipe(
    tapIf(authState => !authState, () => router.navigate(['/auth/login'])),
    map(authState => authState)
  );
};
