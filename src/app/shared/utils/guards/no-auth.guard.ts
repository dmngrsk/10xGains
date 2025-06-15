import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs/operators';
import { AuthService } from '../../services/auth.service';
import { tapIf } from '../operators/tap-if.operator';

export const noAuthGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return authService.isAuthenticated().pipe(
    tapIf(authState => authState.isAuthenticated, () => router.navigate(['/home'])),
    map(authState => !authState.isAuthenticated)
  );
};
