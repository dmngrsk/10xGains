import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, Mock, vi } from 'vitest';
import { SESSION_NOTIFICATION_TAG, SessionNotificationService } from './session-notification.service';

const content = { title: 'Bench Press', body: 'Set 3/5 · 8 reps @ 60 kg' };

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

    it('should focus a running app rather than reloading it, and open at the session otherwise', async () => {
      const service = createService();

      await service.show('session-1', content);

      expect(showNotification.mock.calls[0][1].data).toMatchObject({
        sessionId: 'session-1',
        onActionClick: { default: { operation: 'focusLastFocusedOrOpen', url: 'sessions/session-1' } },
      });
    });

    it('should offer no action buttons, since tapping the notification already returns there', async () => {
      const service = createService();

      await service.show('session-1', content);

      expect(showNotification.mock.calls[0][1].actions).toBeUndefined();
    });

    it('should carry the app icon, which Chrome otherwise fills with an origin avatar', async () => {
      const service = createService();

      await service.show('session-1', content);

      expect(showNotification.mock.calls[0][1].icon).toBe('/assets/favicon/web-app-manifest-192x192.png');
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

});
