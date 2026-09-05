import { DOCUMENT } from '@angular/common';
import { DestroyRef, inject, Injectable } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationStart, Router } from '@angular/router';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter } from 'rxjs/operators';
import { KeyedDebouncerService } from './keyed-debouncer.service';

/**
 * The shortest gap between two update checks. Checks are driven by navigation rather than a poll,
 * so this caps how often a burst of route changes can hit the network, without the zone-patched
 * interval that would keep the app from ever reporting stable.
 */
export const UPDATE_CHECK_MIN_INTERVAL_MS = 15 * 60 * 1000;

/**
 * Keeps an installed app from getting stuck on a stale build. The service worker downloads a new
 * version in the background but keeps serving the old one to open clients until they navigate away,
 * so this service applies the new version on the next in-app navigation.
 *
 * Navigation is already a context switch, so reloading there is close to invisible - and it keeps a
 * deploy from interrupting a workout, because the user does not change route while working through
 * a session.
 */
@Injectable({
  providedIn: 'root',
})
export class AppUpdateService {
  private readonly debouncerService = inject(KeyedDebouncerService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);
  private readonly router = inject(Router);
  private readonly swUpdate = inject(SwUpdate);

  private isCheckingForUpdate = false;
  private isReloading = false;
  private isUpdatePending = false;
  private lastCheckedAt: number | null = null;

  initialize(): void {
    if (!this.swUpdate.isEnabled) {
      return;
    }

    // Only recorded here. Activating now would leave this client running the old bundle against a
    // service worker serving the new one, so the next lazy route would ask for a chunk hash that no
    // longer exists. Activation and reload have to happen together, at a navigation.
    this.swUpdate.versionUpdates
      .pipe(
        filter((event): event is VersionReadyEvent => event.type === 'VERSION_READY'),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => this.isUpdatePending = true);

    // The cached app is broken beyond what the service worker can repair; a reload is the only way out.
    this.swUpdate.unrecoverable
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.reload());

    this.router.events
      .pipe(
        filter((event): event is NavigationStart => event instanceof NavigationStart),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(event => this.onNavigationStart(event.url));
  }

  private onNavigationStart(url: string): void {
    if (this.isUpdatePending) {
      this.applyUpdate(url);
      return;
    }

    this.checkForUpdate();
  }

  /**
   * The timestamp only moves on a successful check, so a check that failed because the app is
   * offline - or because the service worker has not registered yet, which is the common case on the
   * very first navigation - is retried at the next navigation rather than suppressed for the whole
   * interval.
   */
  private async checkForUpdate(): Promise<void> {
    if (this.isCheckingForUpdate) {
      return;
    }

    const now = Date.now();
    if (this.lastCheckedAt !== null && now - this.lastCheckedAt < UPDATE_CHECK_MIN_INTERVAL_MS) {
      return;
    }

    this.isCheckingForUpdate = true;
    try {
      await this.swUpdate.checkForUpdate();
      this.lastCheckedAt = Date.now();
    } catch {
      // The app is offline or the check failed; the next navigation will try again.
    } finally {
      this.isCheckingForUpdate = false;
    }
  }

  /**
   * Set patches are debounced in memory, and `ngOnDestroy` on the page being left only fires the
   * flush - it does not wait for it. Reloading without settling the debouncer first would drop the
   * user's last logged set, so the flush is awaited before the document is replaced.
   */
  private applyUpdate(url: string): void {
    if (this.isReloading) {
      return;
    }

    this.isReloading = true;
    this.debouncerService.flushCurrentActiveDebounce()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.activateAndLoad(url));
  }

  /**
   * Loads the destination directly rather than reloading the current URL: the router navigation that
   * triggered this is superseded by the document load instead of being rendered and thrown away.
   */
  private async activateAndLoad(url: string): Promise<void> {
    try {
      await this.swUpdate.activateUpdate();
    } catch {
      // Activation failed; load the version currently being served rather than stalling here.
    }

    this.document.location.assign(url);
  }

  private reload(): void {
    this.document.location.reload();
  }
}
