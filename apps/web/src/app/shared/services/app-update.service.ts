import { DOCUMENT } from '@angular/common';
import { ApplicationRef, DestroyRef, inject, Injectable, Injector } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { concat, from, fromEvent, interval, merge } from 'rxjs';
import { filter, switchMap, take } from 'rxjs/operators';

/**
 * How often a running app asks the server whether a newer version has been deployed. An installed
 * PWA is rarely closed, so without this poll the app would only ever check on a cold start.
 */
export const UPDATE_CHECK_INTERVAL_MS = 15 * 60 * 1000;

/**
 * Keeps an installed app from getting stuck on a stale build. The service worker downloads a new
 * version in the background but keeps serving the old one to open clients until they navigate away,
 * so this service asks the user to reload once the new version is ready to be activated.
 */
@Injectable({
  providedIn: 'root',
})
export class AppUpdateService {
  private readonly appRef = inject(ApplicationRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);
  private readonly swUpdate = inject(SwUpdate);

  private isPrompting = false;

  initialize(): void {
    if (!this.swUpdate.isEnabled) {
      return;
    }

    this.swUpdate.versionUpdates
      .pipe(
        filter((event): event is VersionReadyEvent => event.type === 'VERSION_READY'),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => this.promptForReload());

    // The cached app is broken beyond what the service worker can repair; a reload is the only way out.
    this.swUpdate.unrecoverable
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.reload());

    // Polling before the app is stable would keep it from ever becoming stable, which in turn
    // would keep the service worker from registering under the 'registerWhenStable' strategy.
    const appIsStable$ = this.appRef.isStable.pipe(filter(isStable => isStable), take(1));
    const updateChecks$ = merge(
      interval(UPDATE_CHECK_INTERVAL_MS),
      fromEvent(this.document, 'visibilitychange').pipe(filter(() => this.document.visibilityState === 'visible'))
    );

    concat(appIsStable$, updateChecks$)
      .pipe(
        switchMap(() => from(this.checkForUpdate())),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe();
  }

  private async checkForUpdate(): Promise<void> {
    try {
      await this.swUpdate.checkForUpdate();
    } catch {
      // The app is offline or the check failed; the next poll will try again.
    }
  }

  /**
   * Deferring leaves the downloaded version sitting ready: this client keeps being served the old
   * one until it reloads, and the prompt does not come back until the next deployment.
   *
   * The dialog and Angular Material's dialog infrastructure are imported on demand: a prompt shown
   * once per deployment does not belong in the bundle every cold start has to download.
   */
  private async promptForReload(): Promise<void> {
    if (this.isPrompting) {
      return;
    }

    this.isPrompting = true;
    const [{ MatDialog }, { AppUpdateDialogComponent }] = await Promise.all([
      import('@angular/material/dialog'),
      import('@shared/ui/dialogs/app-update-dialog/app-update-dialog.component'),
    ]);

    this.injector
      .get(MatDialog)
      .open<InstanceType<typeof AppUpdateDialogComponent>, void, boolean>(AppUpdateDialogComponent, {
        disableClose: true,
        width: '400px',
      })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(async shouldReload => {
        this.isPrompting = false;
        if (!shouldReload) {
          return;
        }

        await this.swUpdate.activateUpdate();
        this.reload();
      });
  }

  private reload(): void {
    this.document.location.reload();
  }
}
