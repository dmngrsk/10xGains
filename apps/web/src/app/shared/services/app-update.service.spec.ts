import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { Event as RouterEvent, NavigationEnd, NavigationStart, Router } from '@angular/router';
import { SwUpdate, VersionEvent } from '@angular/service-worker';
import { Observable, Subject, of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, Mock, vi } from 'vitest';
import { AppUpdateService, UPDATE_CHECK_MIN_INTERVAL_MS } from './app-update.service';
import { KeyedDebouncerService } from './keyed-debouncer.service';

class FakeDocument {
  location = { assign: vi.fn(), reload: vi.fn() };
}

const versionReadyEvent: VersionEvent = {
  type: 'VERSION_READY',
  currentVersion: { hash: 'old' },
  latestVersion: { hash: 'new' },
};

describe('AppUpdateService', () => {
  let activateUpdate: Mock;
  let checkForUpdate: Mock;
  let document: FakeDocument;
  let flushCurrentActiveDebounce: Mock;
  let navigationId: number;
  let now: number;
  let routerEvents: Subject<RouterEvent>;
  let unrecoverable: Subject<{ type: 'UNRECOVERABLE_STATE'; reason: string }>;
  let versionUpdates: Subject<VersionEvent>;

  function createService(isEnabled = true): AppUpdateService {
    TestBed.configureTestingModule({
      providers: [
        { provide: DOCUMENT, useValue: document },
        { provide: KeyedDebouncerService, useValue: { flushCurrentActiveDebounce } },
        { provide: Router, useValue: { events: routerEvents.asObservable() } },
        {
          provide: SwUpdate,
          useValue: { isEnabled, versionUpdates, unrecoverable, checkForUpdate, activateUpdate },
        },
      ],
    });

    return TestBed.inject(AppUpdateService);
  }

  function navigate(url = '/home'): void {
    routerEvents.next(new NavigationStart(++navigationId, url));
  }

  /** Lets the check's promise chain settle without leaning on timers. */
  async function settle(): Promise<void> {
    for (let i = 0; i < 5; i++) {
      await Promise.resolve();
    }
  }

  beforeEach(() => {
    activateUpdate = vi.fn().mockResolvedValue(true);
    checkForUpdate = vi.fn().mockResolvedValue(true);
    document = new FakeDocument();
    flushCurrentActiveDebounce = vi.fn().mockReturnValue(of(undefined));
    navigationId = 0;
    now = 1_000_000;
    routerEvents = new Subject();
    unrecoverable = new Subject();
    versionUpdates = new Subject();

    vi.spyOn(Date, 'now').mockImplementation(() => now);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
  });

  it('should stay inert when the service worker is disabled', async () => {
    const service = createService(false);

    service.initialize();
    navigate();
    versionUpdates.next(versionReadyEvent);
    navigate('/plans');

    await settle();
    expect(checkForUpdate).not.toHaveBeenCalled();
    expect(document.location.assign).not.toHaveBeenCalled();
  });

  describe('checking for an update', () => {
    it('should check for an update on navigation', async () => {
      const service = createService();

      service.initialize();
      navigate();

      await settle();
      expect(checkForUpdate).toHaveBeenCalledTimes(1);
    });

    it('should not check before the first navigation', () => {
      const service = createService();

      service.initialize();

      expect(checkForUpdate).not.toHaveBeenCalled();
    });

    it('should ignore router events other than a navigation start', async () => {
      const service = createService();

      service.initialize();
      routerEvents.next(new NavigationEnd(1, '/home', '/home'));

      await settle();
      expect(checkForUpdate).not.toHaveBeenCalled();
    });

    it('should not check again within the minimum interval', async () => {
      const service = createService();

      service.initialize();
      navigate();
      await settle();

      now += UPDATE_CHECK_MIN_INTERVAL_MS - 1;
      navigate('/plans');
      await settle();

      expect(checkForUpdate).toHaveBeenCalledTimes(1);
    });

    it('should check again once the minimum interval has elapsed', async () => {
      const service = createService();

      service.initialize();
      navigate();
      await settle();

      now += UPDATE_CHECK_MIN_INTERVAL_MS;
      navigate('/plans');
      await settle();

      expect(checkForUpdate).toHaveBeenCalledTimes(2);
    });

    it('should retry at the next navigation when a check fails', async () => {
      // The service worker has not registered yet on the very first navigation, so the first check
      // rejects; suppressing checks for the whole interval would leave the app stale for no reason.
      checkForUpdate.mockRejectedValueOnce(new Error('not registered'));
      const service = createService();

      service.initialize();
      navigate();
      await settle();

      navigate('/plans');
      await settle();

      expect(checkForUpdate).toHaveBeenCalledTimes(2);
    });

    it('should not run overlapping checks when navigations arrive together', async () => {
      let resolveCheck: (value: boolean) => void = () => undefined;
      checkForUpdate.mockReturnValueOnce(new Promise<boolean>(resolve => resolveCheck = resolve));
      const service = createService();

      service.initialize();
      navigate();
      navigate('/plans');
      await settle();

      expect(checkForUpdate).toHaveBeenCalledTimes(1);
      resolveCheck(true);
    });
  });

  describe('applying an update', () => {
    it('should ignore version events other than a ready one', async () => {
      const service = createService();

      service.initialize();
      versionUpdates.next({ type: 'VERSION_DETECTED', version: { hash: 'new' } });
      versionUpdates.next({ type: 'NO_NEW_VERSION_DETECTED', version: { hash: 'old' } });
      navigate();

      await settle();
      expect(activateUpdate).not.toHaveBeenCalled();
      expect(document.location.assign).not.toHaveBeenCalled();
    });

    it('should leave the running version alone until the next navigation', async () => {
      const service = createService();

      service.initialize();
      versionUpdates.next(versionReadyEvent);

      await settle();
      expect(activateUpdate).not.toHaveBeenCalled();
      expect(document.location.assign).not.toHaveBeenCalled();
    });

    it('should activate the update and load the destination on the next navigation', async () => {
      const service = createService();

      service.initialize();
      versionUpdates.next(versionReadyEvent);
      navigate('/plans');

      await vi.waitFor(() => expect(document.location.assign).toHaveBeenCalledWith('/plans'));
      expect(activateUpdate).toHaveBeenCalledTimes(1);
    });

    it('should settle pending debounced work before loading', async () => {
      const flushed = new Subject<void>();
      flushCurrentActiveDebounce.mockReturnValue(flushed as unknown as Observable<void>);
      const service = createService();

      service.initialize();
      versionUpdates.next(versionReadyEvent);
      navigate('/plans');
      await settle();

      expect(flushCurrentActiveDebounce).toHaveBeenCalledTimes(1);
      expect(document.location.assign).not.toHaveBeenCalled();

      flushed.next();
      await vi.waitFor(() => expect(document.location.assign).toHaveBeenCalledWith('/plans'));
    });

    it('should skip the update check once an update is pending', async () => {
      const service = createService();

      service.initialize();
      versionUpdates.next(versionReadyEvent);
      navigate('/plans');

      await settle();
      expect(checkForUpdate).not.toHaveBeenCalled();
    });

    it('should load the destination even when activation fails', async () => {
      activateUpdate.mockRejectedValue(new Error('activation failed'));
      const service = createService();

      service.initialize();
      versionUpdates.next(versionReadyEvent);
      navigate('/plans');

      await vi.waitFor(() => expect(document.location.assign).toHaveBeenCalledWith('/plans'));
    });

    it('should not stack reloads across successive navigations', async () => {
      const service = createService();

      service.initialize();
      versionUpdates.next(versionReadyEvent);
      navigate('/plans');
      navigate('/progress');

      await vi.waitFor(() => expect(document.location.assign).toHaveBeenCalledTimes(1));
      expect(document.location.assign).toHaveBeenCalledWith('/plans');
    });
  });

  it('should reload immediately when the cached app is unrecoverable', () => {
    const service = createService();

    service.initialize();
    unrecoverable.next({ type: 'UNRECOVERABLE_STATE', reason: 'missing asset' });

    expect(document.location.reload).toHaveBeenCalledTimes(1);
    expect(document.location.assign).not.toHaveBeenCalled();
  });
});
