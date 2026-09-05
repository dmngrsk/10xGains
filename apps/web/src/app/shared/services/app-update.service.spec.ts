import { DOCUMENT } from '@angular/common';
import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { SwUpdate, VersionEvent } from '@angular/service-worker';
import { Observable, of, Subject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, Mock, vi } from 'vitest';
import { AppUpdateDialogComponent } from '@shared/ui/dialogs/app-update-dialog/app-update-dialog.component';
import { AppUpdateService, UPDATE_CHECK_INTERVAL_MS } from './app-update.service';

class FakeDocument extends EventTarget {
  visibilityState: DocumentVisibilityState = 'visible';
  location = { reload: vi.fn() };
}

const versionReadyEvent: VersionEvent = {
  type: 'VERSION_READY',
  currentVersion: { hash: 'old' },
  latestVersion: { hash: 'new' },
};

describe('AppUpdateService', () => {
  let activateUpdate: Mock;
  let afterClosed: Subject<boolean | undefined>;
  let checkForUpdate: Mock;
  let dialogOpen: Mock;
  let document: FakeDocument;
  let isStable: Observable<boolean>;
  let unrecoverable: Subject<{ type: 'UNRECOVERABLE_STATE'; reason: string }>;
  let versionUpdates: Subject<VersionEvent>;

  function createService(isEnabled = true): AppUpdateService {
    TestBed.configureTestingModule({
      providers: [
        { provide: ApplicationRef, useValue: { isStable } },
        { provide: DOCUMENT, useValue: document },
        { provide: MatDialog, useValue: { open: dialogOpen } },
        {
          provide: SwUpdate,
          useValue: { isEnabled, versionUpdates, unrecoverable, checkForUpdate, activateUpdate },
        },
      ],
    });

    return TestBed.inject(AppUpdateService);
  }

  /**
   * The dialog and its Material dependencies are imported on demand, so a prompt opens asynchronously.
   * Awaiting the same imports lets a test observe the state the service settles into.
   */
  async function settle(): Promise<void> {
    await Promise.all([
      import('@angular/material/dialog'),
      import('@shared/ui/dialogs/app-update-dialog/app-update-dialog.component'),
    ]);
    await Promise.resolve();
  }

  async function waitForPrompts(count: number): Promise<void> {
    await vi.waitFor(() => expect(dialogOpen).toHaveBeenCalledTimes(count));
  }

  function becomeVisible(visibilityState: DocumentVisibilityState = 'visible'): void {
    document.visibilityState = visibilityState;
    document.dispatchEvent(new Event('visibilitychange'));
  }

  beforeEach(() => {
    activateUpdate = vi.fn().mockResolvedValue(true);
    afterClosed = new Subject();
    checkForUpdate = vi.fn().mockResolvedValue(true);
    dialogOpen = vi.fn().mockReturnValue({ afterClosed: () => afterClosed });
    document = new FakeDocument();
    isStable = of(true);
    unrecoverable = new Subject();
    versionUpdates = new Subject();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.useRealTimers();
  });

  it('should stay inert when the service worker is disabled', () => {
    const service = createService(false);

    service.initialize();
    versionUpdates.next(versionReadyEvent);

    expect(checkForUpdate).not.toHaveBeenCalled();
    expect(dialogOpen).not.toHaveBeenCalled();
  });

  it('should check for an update once the app is stable', () => {
    const service = createService();

    service.initialize();

    expect(checkForUpdate).toHaveBeenCalledTimes(1);
  });

  it('should not check for an update before the app is stable', () => {
    isStable = of(false);
    const service = createService();

    service.initialize();

    expect(checkForUpdate).not.toHaveBeenCalled();
  });

  it('should keep checking for an update on the poll interval', () => {
    vi.useFakeTimers();
    const service = createService();

    service.initialize();
    vi.advanceTimersByTime(UPDATE_CHECK_INTERVAL_MS * 2);

    expect(checkForUpdate).toHaveBeenCalledTimes(3);
  });

  it('should check for an update when a backgrounded app becomes visible again', () => {
    const service = createService();

    service.initialize();
    becomeVisible('hidden');
    becomeVisible();

    // One check on stability, one for becoming visible; the 'hidden' transition is ignored.
    expect(checkForUpdate).toHaveBeenCalledTimes(2);
  });

  it('should swallow a failed check so later ones still run', async () => {
    checkForUpdate.mockRejectedValueOnce(new Error('offline'));
    const service = createService();

    service.initialize();
    await vi.waitFor(() => expect(checkForUpdate).toHaveBeenCalledTimes(1));
    becomeVisible();

    expect(checkForUpdate).toHaveBeenCalledTimes(2);
  });

  it('should prompt when a new version is ready', async () => {
    const service = createService();

    service.initialize();
    versionUpdates.next(versionReadyEvent);

    await vi.waitFor(() =>
      expect(dialogOpen).toHaveBeenCalledWith(AppUpdateDialogComponent, { disableClose: true, width: '400px' })
    );
  });

  it('should ignore version events other than a ready one', async () => {
    const service = createService();

    service.initialize();
    versionUpdates.next({ type: 'VERSION_DETECTED', version: { hash: 'new' } });
    versionUpdates.next({ type: 'NO_NEW_VERSION_DETECTED', version: { hash: 'old' } });

    await settle();
    expect(dialogOpen).not.toHaveBeenCalled();
  });

  it('should activate the update and reload when the user accepts', async () => {
    const service = createService();

    service.initialize();
    versionUpdates.next(versionReadyEvent);
    await waitForPrompts(1);
    afterClosed.next(true);

    await vi.waitFor(() => expect(document.location.reload).toHaveBeenCalledTimes(1));
    expect(activateUpdate).toHaveBeenCalledTimes(1);
  });

  it('should leave the running version alone when the user defers the update', async () => {
    const service = createService();

    service.initialize();
    versionUpdates.next(versionReadyEvent);
    await waitForPrompts(1);
    afterClosed.next(false);

    expect(activateUpdate).not.toHaveBeenCalled();
    expect(document.location.reload).not.toHaveBeenCalled();
  });

  it('should not stack prompts while one is already open', async () => {
    const service = createService();

    service.initialize();
    versionUpdates.next(versionReadyEvent);
    versionUpdates.next(versionReadyEvent);

    await waitForPrompts(1);
    await settle();
    expect(dialogOpen).toHaveBeenCalledTimes(1);
  });

  it('should prompt again for a later version once the user has deferred', async () => {
    const service = createService();

    service.initialize();
    versionUpdates.next(versionReadyEvent);
    await waitForPrompts(1);
    afterClosed.next(false);
    versionUpdates.next(versionReadyEvent);

    await waitForPrompts(2);
  });

  it('should reload without prompting when the cached app is unrecoverable', () => {
    const service = createService();

    service.initialize();
    unrecoverable.next({ type: 'UNRECOVERABLE_STATE', reason: 'missing asset' });

    expect(dialogOpen).not.toHaveBeenCalled();
    expect(document.location.reload).toHaveBeenCalledTimes(1);
  });
});
