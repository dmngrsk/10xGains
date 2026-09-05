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

  /** Stands in for the notification already on screen, which is what `show` now compares against. */
  function setExisting(...notifications: Record<string, unknown>[]): void {
    getNotifications.mockResolvedValue(notifications.map(n => ({ close, ...n })));
  }

  beforeEach(() => {
    close = vi.fn();
    getNotifications = vi.fn().mockResolvedValue([]);
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
        silent: true,
        requireInteraction: true,
      }));
    });

    it('should name the session the click should return to', async () => {
      const service = createService();

      await service.show('session-1', content);

      expect(showNotification.mock.calls[0][1].data).toMatchObject({ sessionId: 'session-1' });
    });

    it('should leave ngsw no click protocol to act on, so the worker owns every action', async () => {
      const service = createService();

      await service.show('session-1', content, action);

      expect(showNotification.mock.calls[0][1].data.onActionClick).toBeUndefined();
    });

    it('should offer only the open action when there is no token yet', async () => {
      const service = createService();

      await service.show('session-1', content);

      expect(showNotification.mock.calls[0][1].actions).toEqual([{ action: 'open', title: 'View session' }]);
    });

    it('should offer the complete action once a token is available', async () => {
      const service = createService();

      await service.show('session-1', content, action);

      expect(showNotification.mock.calls[0][1].actions).toEqual([
        { action: 'complete-set', title: 'Complete' },
        { action: 'open', title: 'View session' },
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

    it('should show again once the set the action targets changes', async () => {
      const service = createService();

      await service.show('session-1', content, action);
      await service.show('session-1', content, { ...action, setId: 'set-4' });

      expect(showNotification).toHaveBeenCalledTimes(2);
    });

    it('should not re-show when the notification on screen already matches', async () => {
      // Deliberately without a prior show(): a relaunched app has no in-memory state, and reposting
      // on every launch was the bug this replaces.
      setExisting({ title: content.title, body: content.body, data: { sessionId: 'session-1' } });
      const service = createService();

      await service.show('session-1', content);

      expect(showNotification).not.toHaveBeenCalled();
    });

    it('should re-show when the body on screen is stale', async () => {
      setExisting({ title: content.title, body: 'Set 2/5 · 8 reps @ 60 kg', data: { sessionId: 'session-1' } });
      const service = createService();

      await service.show('session-1', content);

      expect(showNotification).toHaveBeenCalledTimes(1);
    });

    it('should re-show when the notification on screen carries a different token', async () => {
      setExisting({
        title: content.title,
        body: content.body,
        data: { sessionId: 'session-1', setId: 'set-3', token: 'stale-token' },
      });
      const service = createService();

      await service.show('session-1', content, action);

      expect(showNotification).toHaveBeenCalledTimes(1);
    });

    it('should carry a monochrome badge for the status bar', async () => {
      const service = createService();

      await service.show('session-1', content);

      expect(showNotification.mock.calls[0][1].badge).toBe('/assets/favicon/notification-badge.png');
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
    it('should look notifications up by tag', async () => {
      const service = createService();

      await service.clear();

      expect(getNotifications).toHaveBeenCalledWith({ tag: SESSION_NOTIFICATION_TAG });
    });

    it('should close every notification it finds under the tag', async () => {
      setExisting({}, {});
      const service = createService();

      await service.clear();

      expect(close).toHaveBeenCalledTimes(2);
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

  describe('readActionToken', () => {
    it('should adopt the token the notification on screen already carries', async () => {
      setExisting({ data: { sessionId: 'session-1', token: 'token-abc' } });
      const service = createService();

      await expect(service.readActionToken('session-1')).resolves.toBe('token-abc');
    });

    it('should ignore a token minted for a different session', async () => {
      setExisting({ data: { sessionId: 'session-2', token: 'token-abc' } });
      const service = createService();

      await expect(service.readActionToken('session-1')).resolves.toBeNull();
    });

    it('should report nothing when no notification is on screen', async () => {
      const service = createService();

      await expect(service.readActionToken('session-1')).resolves.toBeNull();
    });
  });
});
