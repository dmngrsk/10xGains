import { Injectable } from '@angular/core';

/** The text shown on the notification. */
export interface SessionNotificationContent {
  title: string;
  body: string;
}

/** What the service worker needs to complete a set on its own, with no page running. */
export interface SessionNotificationAction {
  /** Absolute, including the `/api` prefix: the worker cannot read `environment`. */
  apiBaseUrl: string;
  setId: string;
  token: string;
}

/** A fixed tag replaces the notification already on screen rather than stacking a second one. */
export const SESSION_NOTIFICATION_TAG = 'active-session';

const SESSION_NOTIFICATION_ICON = '/assets/favicon/web-app-manifest-192x192.png';

/** Action buttons are service-worker only, so TypeScript's DOM lib omits them from the options. */
interface PersistentNotificationOptions extends NotificationOptions {
  actions?: { action: string; title: string }[];
}

/**
 * Keeps a notification on screen for as long as a session is in progress.
 *
 * It belongs to the service worker registration rather than to a page, so it outlives the tab being
 * closed or the installed app being swiped away - which is the whole point of it.
 */
@Injectable({
  providedIn: 'root',
})
export class SessionNotificationService {
  private lastShownKey: string | null = null;

  /**
   * Clears anything left over from a session that was killed mid-workout or finished elsewhere. A
   * session that really is in progress re-shows its notification as soon as it loads, so no state
   * has to be persisted to tell the two apart.
   */
  initialize(): void {
    void this.clear();
  }

  /**
   * Permission has to be requested from a user gesture, and a denial is permanent, so this is called
   * when the user is on their way into a workout rather than on startup.
   */
  async requestPermission(): Promise<void> {
    if (!this.isSupported() || Notification.permission !== 'default') {
      return;
    }

    try {
      await Notification.requestPermission();
    } catch {
      // Some browsers reject outside a user gesture; the feature simply stays off.
    }
  }

  /** Whether a notification would actually be shown, so callers can skip work that only feeds one. */
  isEnabled(): boolean {
    return this.isSupported() && Notification.permission === 'granted';
  }

  async show(sessionId: string, content: SessionNotificationContent, action?: SessionNotificationAction): Promise<void> {
    if (!this.isEnabled()) {
      return;
    }

    // Callers re-derive this on every session change, most of which do not affect the text, and
    // re-showing would bump the notification back to the top of the shade each time.
    const key = `${sessionId}|${content.title}|${content.body}|${action?.setId ?? ''}|${action?.token ?? ''}`;
    if (key === this.lastShownKey) {
      return;
    }

    const registration = await this.getRegistration();
    if (!registration) {
      return;
    }

    // Resolved against the service worker's scope, so the URL stays relative.
    const openAction = { operation: 'navigateLastFocusedOrOpen', url: `sessions/${sessionId}` };

    // 'complete-set' is deliberately absent from onActionClick: ngsw would navigate for it, and not
    // opening the app is the point. sw.js handles that action instead.
    const options: PersistentNotificationOptions = {
      body: content.body,
      tag: SESSION_NOTIFICATION_TAG,
      icon: SESSION_NOTIFICATION_ICON,
      silent: true,
      requireInteraction: true,
      actions: action
        ? [{ action: 'complete-set', title: 'Complete set' }, { action: 'open', title: 'Open' }]
        : [{ action: 'open', title: 'Open' }],
      data: {
        sessionId,
        title: content.title,
        apiBaseUrl: action?.apiBaseUrl,
        setId: action?.setId,
        token: action?.token,
        onActionClick: { default: openAction, open: openAction },
      },
    };

    await registration.showNotification(content.title, options);

    this.lastShownKey = key;
  }

  async clear(): Promise<void> {
    this.lastShownKey = null;

    const registration = await this.getRegistration();
    if (!registration) {
      return;
    }

    const notifications = await registration.getNotifications({ tag: SESSION_NOTIFICATION_TAG });
    notifications.forEach(notification => notification.close());
  }

  /**
   * `getRegistration` rather than `ready`: the latter never settles when no service worker is
   * registered, which is every development build.
   */
  private async getRegistration(): Promise<ServiceWorkerRegistration | null> {
    if (!this.isSupported()) {
      return null;
    }

    try {
      return (await navigator.serviceWorker.getRegistration()) ?? null;
    } catch {
      return null;
    }
  }

  private isSupported(): boolean {
    return typeof Notification !== 'undefined' && typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
  }
}
