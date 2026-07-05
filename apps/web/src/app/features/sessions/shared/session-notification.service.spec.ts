import { TestBed } from '@angular/core/testing';
import { SwPush } from '@angular/service-worker';
import { Subject } from 'rxjs';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SessionNotificationContent, SessionNotificationService } from './session-notification.service';

interface NotificationClickEvent { action: string; notification: unknown; }

const content: SessionNotificationContent = {
  sessionId: 's1',
  title: 'Push Day',
  exerciseName: 'Bench Press',
  reps: 5,
  weight: 60,
};

describe('SessionNotificationService', () => {
  let clicks$: Subject<NotificationClickEvent>;
  let showNotification: ReturnType<typeof vi.fn>;
  let getNotifications: ReturnType<typeof vi.fn>;

  const configure = (swEnabled: boolean, permission: NotificationPermission = 'granted') => {
    clicks$ = new Subject<NotificationClickEvent>();
    showNotification = vi.fn().mockResolvedValue(undefined);
    getNotifications = vi.fn().mockResolvedValue([]);

    Object.defineProperty(navigator, 'serviceWorker', {
      value: { ready: Promise.resolve({ showNotification, getNotifications }) },
      configurable: true,
    });
    vi.stubGlobal('Notification', {
      permission,
      requestPermission: vi.fn().mockResolvedValue('granted'),
    });

    TestBed.configureTestingModule({
      providers: [
        SessionNotificationService,
        { provide: SwPush, useValue: { isEnabled: swEnabled, notificationClicks: clicks$.asObservable() } },
      ],
    });
    return TestBed.inject(SessionNotificationService);
  };

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    TestBed.resetTestingModule();
  });

  describe('when the service worker is disabled', () => {
    let service: SessionNotificationService;
    beforeEach(() => { service = configure(false); });

    it('reports unsupported and no-ops', async () => {
      expect(service.isSupported).toBe(false);
      await expect(service.requestPermission()).resolves.toBe('denied');
      await expect(service.show(content)).resolves.toBeUndefined();
      expect(showNotification).not.toHaveBeenCalled();
    });
  });

  describe('when supported and permission granted', () => {
    let service: SessionNotificationService;
    beforeEach(() => { service = configure(true, 'granted'); });
    afterEach(async () => { await service.clear(); });

    it('shows an ongoing notification with the current set and quick actions', async () => {
      await service.show(content);

      expect(showNotification).toHaveBeenCalledTimes(1);
      const [title, options] = showNotification.mock.calls[0];
      expect(title).toBe('Push Day');
      expect(options.body).toBe('Bench Press · 60 kg · 5 reps');
      expect(options.tag).toBe('session-active');
      expect(options.requireInteraction).toBe(true);
      expect(options.actions.map((a: { action: string }) => a.action)).toEqual(['complete-set', 'reset-timer']);
      expect(options.data.onActionClick['complete-set'].url).toContain('action=complete-set');
    });

    it('omits weight from the body when absent', async () => {
      await service.show({ ...content, weight: null });
      expect(showNotification.mock.calls[0][1].body).toBe('Bench Press · 5 reps');
    });

    it('closes matching notifications on clear', async () => {
      const close = vi.fn();
      getNotifications.mockResolvedValue([{ close }]);
      await service.clear();
      expect(getNotifications).toHaveBeenCalledWith({ tag: 'session-active' });
      expect(close).toHaveBeenCalled();
    });
  });

  describe('actions$', () => {
    it('emits only the two known quick actions', async () => {
      const service = configure(true);
      const received: string[] = [];
      service.actions$.subscribe(a => received.push(a));

      clicks$.next({ action: '', notification: {} });
      clicks$.next({ action: 'complete-set', notification: {} });
      clicks$.next({ action: 'unknown', notification: {} });
      clicks$.next({ action: 'reset-timer', notification: {} });

      expect(received).toEqual(['complete-set', 'reset-timer']);
      await service.clear();
    });
  });
});
