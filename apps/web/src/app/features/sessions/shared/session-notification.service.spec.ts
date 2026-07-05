import { TestBed } from '@angular/core/testing';
import { SwPush } from '@angular/service-worker';
import { Subject, of } from 'rxjs';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PushService } from '@shared/api/push.service';
import { SessionNotificationService } from './session-notification.service';

vi.mock('../../../../environments/environment', () => ({
  environment: { vapidPublicKey: 'TEST_VAPID_KEY' },
}));

interface NotificationClickEvent { action: string; notification: unknown; }

describe('SessionNotificationService', () => {
  let clicks$: Subject<NotificationClickEvent>;
  let getNotifications: ReturnType<typeof vi.fn>;
  let requestSubscription: ReturnType<typeof vi.fn>;
  let saveSubscription: ReturnType<typeof vi.fn>;

  const configure = (swEnabled: boolean, permission: NotificationPermission = 'granted') => {
    clicks$ = new Subject<NotificationClickEvent>();
    getNotifications = vi.fn().mockResolvedValue([]);
    requestSubscription = vi.fn();
    saveSubscription = vi.fn().mockReturnValue(of({ data: null, error: null }));

    Object.defineProperty(navigator, 'serviceWorker', {
      value: { ready: Promise.resolve({ getNotifications }) },
      configurable: true,
    });
    vi.stubGlobal('Notification', {
      permission,
      requestPermission: vi.fn().mockResolvedValue('granted'),
    });

    TestBed.configureTestingModule({
      providers: [
        SessionNotificationService,
        { provide: SwPush, useValue: { isEnabled: swEnabled, notificationClicks: clicks$.asObservable(), requestSubscription } },
        { provide: PushService, useValue: { saveSubscription } },
      ],
    });
    return TestBed.inject(SessionNotificationService);
  };

  afterEach(() => {
    vi.unstubAllGlobals();
    TestBed.resetTestingModule();
  });

  describe('when the service worker is disabled', () => {
    let service: SessionNotificationService;
    beforeEach(() => { service = configure(false); });

    it('reports unsupported and no-ops', async () => {
      expect(service.isSupported).toBe(false);
      await expect(service.requestPermission()).resolves.toBe('denied');
      await expect(service.subscribeToPush()).resolves.toBeUndefined();
      await expect(service.clear()).resolves.toBeUndefined();
      expect(requestSubscription).not.toHaveBeenCalled();
    });
  });

  describe('subscribeToPush', () => {
    it('requests a push subscription and registers it with the API', async () => {
      const service = configure(true, 'granted');
      const subscription = {
        endpoint: 'https://push/1',
        toJSON: () => ({ endpoint: 'https://push/1', keys: { p256dh: 'p', auth: 'a' } }),
      } as unknown as PushSubscription;
      requestSubscription.mockResolvedValue(subscription);

      await service.subscribeToPush();

      expect(requestSubscription).toHaveBeenCalledWith({ serverPublicKey: 'TEST_VAPID_KEY' });
      expect(saveSubscription).toHaveBeenCalledWith({ endpoint: 'https://push/1', keys: { p256dh: 'p', auth: 'a' } });
    });

    it('does nothing when permission is not granted', async () => {
      const service = configure(true, 'default');
      await service.subscribeToPush();
      expect(requestSubscription).not.toHaveBeenCalled();
    });
  });

  describe('clear', () => {
    it('closes matching ongoing notifications', async () => {
      const service = configure(true, 'granted');
      const close = vi.fn();
      getNotifications.mockResolvedValue([{ close }]);

      await service.clear();

      expect(getNotifications).toHaveBeenCalledWith({ tag: 'session-active' });
      expect(close).toHaveBeenCalled();
    });
  });

  describe('actions$', () => {
    it('emits only the two known quick actions', () => {
      const service = configure(true);
      const received: string[] = [];
      service.actions$.subscribe(a => received.push(a));

      clicks$.next({ action: '', notification: {} });
      clicks$.next({ action: 'complete-set', notification: {} });
      clicks$.next({ action: 'unknown', notification: {} });
      clicks$.next({ action: 'reset-timer', notification: {} });

      expect(received).toEqual(['complete-set', 'reset-timer']);
    });
  });
});
