import { DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { distinctUntilChanged, map, skip } from 'rxjs/operators';
import { AuthService } from '../../services/auth.service';

/**
 * Clears a service's cached state whenever the signed-in user changes.
 *
 * Page facades are `providedIn: 'root'` singletons, so they outlive the routes that use them and,
 * more importantly, they outlive a session. Signing out and back in as someone else in the same tab
 * left the previous user's data in place - the history calendar rendered their sessions for months
 * it had already fetched, and the plan editor reused their profile. On a shared device that is a
 * data-exposure bug, not merely stale state.
 *
 * Call this from an injection context (a field initializer or constructor) and clear every cache the
 * service holds. Sign-out counts as a change: the caches are dropped then rather than being left for
 * whoever signs in next.
 *
 * @param reset Clears all per-user state the caller has cached.
 */
export function resetOnUserChange(reset: () => void): void {
  const authService = inject(AuthService);
  const destroyRef = inject(DestroyRef);

  authService.currentUser$
    .pipe(
      map(user => user?.id ?? null),
      distinctUntilChanged(),
      // The first emission reports who is already signed in, and nothing has been cached under
      // them yet - resetting on it would throw away state the caller just loaded.
      skip(1),
      takeUntilDestroyed(destroyRef)
    )
    .subscribe(() => reset());
}
