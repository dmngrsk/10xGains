import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, Mock, vi } from 'vitest';
import { SESSION_NOTIFICATION_TAG, SessionNotificationService } from './session-notification.service';

const content = { title: 'Bench Press', body: 'Set 3/5 · 8 reps @ 60 kg' };
const action = { apiBaseUrl: 'https://api.example.test/api', setId: 'set-3', token: 'token-abc' };

describe('SessionNotificationService', () => {
  let close: Mock;
  let getNotifications: Mock;
  let getRegistration: Mock;
  let requestPermission: Mock;
  let showNotification: Mock;

  function createService(): SessionNotificationService {
    TestBed.configureTestingModule({});
    return TestBed.inject(SessionNotificationService);
  }

  function setPermission(permission: NotificationPermission | undefined): void {
    vi.stubGlobal(
      'Notification',
      permission === undefined ? undefined : { permission, requestPermission }
    );
  }

  beforeEach(() => {
    close = vi.fn();
    getNotifications = vi.fn().mockResolvedValue([{ close }, { close }]);
    showNotification = vi.fn().mockResolvedValue(undefined);
    getRegistration = vi.fn().mockResolvedValue({ showNotification, getNotifications });
    requestPermission = vi.fn().mockResolvedValue('granted');

    setPermission('granted');
    vi.stubGlobal('navigator', { serviceWorker: { getRegistration } });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('show', () => {
    it('should show a tagged notification for the session', async () => {
      const service = createService();

      await service.show('session-1', content);

      expect(showNotification).toHaveBeenCalledWith('Bench Press', expect.objectContaining({
        body: 'Set 3/5 · 8 reps @ 60 kg',
        tag: SESSION_NOTIFICATION_TAG,
        icon: '/assets/favicon/web-app-manifest-192x192.png',
        silent: true,
        requireInteraction: true,
      }));
    });

    it('should route a click back into the session', async () => {
      const service = createService();

      await service.show('session-1', content);

      const open = { operation: 'navigateLastFocusedOrOpen', url: 'sessions/session-1' };
      expect(showNotification.mock.calls[0][1].data).toMatchObject({
        sessionId: 'session-1',
        onActionClick: { default: open, open },
      });
    });

    it('should offer only the open action when there is no token yet', async () => {
      const service = createService();

      await service.show('session-1', content);

      expect(showNotification.mock.calls[0][1].actions).toEqual([{ action: 'open', title: 'Open' }]);
    });

    it('should offer the complete action once a token is available', async () => {
      const service = createService();

      await service.show('session-1', content, action);

      expect(showNotification.mock.calls[0][1].actions).toEqual([
        { action: 'complete-set', title: 'Complete set' },
        { action: 'open', title: 'Open' },
      ]);
    });

    it('should carry everything the service worker needs to complete the set', async () => {
      const service = createService();

      await service.show('session-1', content, action);

      expect(showNotification.mock.calls[0][1].data).toMatchObject({
        sessionId: 'session-1',
        title: 'Bench Press',
        apiBaseUrl: 'https://api.example.test/api',
        setId: 'set-3',
        token: 'token-abc',
      });
    });

    it('should leave the complete action out of onActionClick, so ngsw does not navigate for it', async () => {
      const service = createService();

      await service.show('session-1', content, action);

      expect(showNotification.mock.calls[0][1].data.onActionClick['complete-set']).toBeUndefined();
    });

    it('should show again once the set the action targets changes', async () => {
      const service = createService();

      await service.show('session-1', content, action);
      await service.show('session-1', content, { ...action, setId: 'set-4' });

      expect(showNotification).toHaveBeenCalledTimes(2);
    });

    it('should not re-show an identical notification', async () => {
      const service = createService();

      await service.show('session-1', content);
      await service.show('session-1', content);

      expect(showNotification).toHaveBeenCalledTimes(1);
    });

    it('should show again once the text changes', async () => {
      const service = createService();

      await service.show('session-1', content);
      await service.show('session-1', { ...content, body: 'Set 4/5 · 8 reps @ 60 kg' });

      expect(showNotification).toHaveBeenCalledTimes(2);
    });

    it('should show again for a different session', async () => {
      const service = createService();

      await service.show('session-1', content);
      await service.show('session-2', content);

      expect(showNotification).toHaveBeenCalledTimes(2);
    });

    it('should stay silent without permission', async () => {
      setPermission('default');
      const service = createService();

      await service.show('session-1', content);

      expect(showNotification).not.toHaveBeenCalled();
    });

    it('should stay silent when notifications are unsupported', async () => {
      setPermission(undefined);
      const service = createService();

      await service.show('session-1', content);

      expect(getRegistration).not.toHaveBeenCalled();
    });

    it('should stay silent when no service worker is registered', async () => {
      getRegistration.mockResolvedValue(undefined);
      const service = createService();

      await expect(service.show('session-1', content)).resolves.toBeUndefined();
      expect(showNotification).not.toHaveBeenCalled();
    });
  });

  describe('clear', () => {
    it('should close every notification carrying the tag', async () => {
      const service = createService();

      await service.clear();

      expect(getNotifications).toHaveBeenCalledWith({ tag: SESSION_NOTIFICATION_TAG });
      expect(close).toHaveBeenCalledTimes(2);
    });

    it('should let identical content be shown again afterwards', async () => {
      const service = createService();

      await service.show('session-1', content);
      await service.clear();
      await service.show('session-1', content);

      expect(showNotification).toHaveBeenCalledTimes(2);
    });
  });

  describe('requestPermission', () => {
    it('should prompt when the user has not been asked yet', async () => {
      setPermission('default');
      const service = createService();

      await service.requestPermission();

      expect(requestPermission).toHaveBeenCalledTimes(1);
    });

    it('should not prompt again once the user has answered', async () => {
      setPermission('denied');
      const service = createService();

      await service.requestPermission();

      expect(requestPermission).not.toHaveBeenCalled();
    });

    it('should survive a browser that rejects the request', async () => {
      setPermission('default');
      requestPermission.mockRejectedValue(new Error('needs a user gesture'));
      const service = createService();

      await expect(service.requestPermission()).resolves.toBeUndefined();
    });
  });

  describe('isEnabled', () => {
    it('should report enabled when permission is granted', () => {
      expect(createService().isEnabled()).toBe(true);
    });

    it('should report disabled without permission, so callers can skip minting a token', () => {
      setPermission('denied');
      expect(createService().isEnabled()).toBe(false);
    });

    it('should report disabled when notifications are unsupported', () => {
      setPermission(undefined);
      expect(createService().isEnabled()).toBe(false);
    });
  });

  it('should clear a leftover notification on startup', async () => {
    const service = createService();

    service.initialize();

    await vi.waitFor(() => expect(close).toHaveBeenCalledTimes(2));
  });
});
