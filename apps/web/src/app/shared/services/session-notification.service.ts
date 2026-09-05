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

// Android keeps only this image's alpha channel and tints the result, so it is a stencil of the
// mark rather than the logo: anything with colour in it would render as a solid blob.
const SESSION_NOTIFICATION_BADGE = '/assets/favicon/notification-badge.png';

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

    const registration = await this.getRegistration();
    if (!registration) {
      return;
    }

    // Compared against the notification actually on screen rather than against a field on this
    // service. An installed app is relaunched constantly, and in-memory state is empty every time,
    // which had the notification re-posting itself - and jumping back to the top of the shade - on
    // every launch instead of only when a set changed.
    const [existing] = await registration.getNotifications({ tag: SESSION_NOTIFICATION_TAG });
    if (existing && matches(existing, sessionId, content, action)) {
      return;
    }

    // Resolved against the service worker's scope, so the URL stays relative.
    const openAction = { operation: 'navigateLastFocusedOrOpen', url: `sessions/${sessionId}` };

    // 'complete-set' is deliberately absent from onActionClick: ngsw would navigate for it, and not
    // opening the app is the point. sw.js handles that action instead.
    const options: PersistentNotificationOptions = {
      body: content.body,
      tag: SESSION_NOTIFICATION_TAG,
      badge: SESSION_NOTIFICATION_BADGE,
      silent: true,
      requireInteraction: true,
      actions: action
        ? [{ action: 'complete-set', title: 'Complete' }, { action: 'open', title: 'View session' }]
        : [{ action: 'open', title: 'View session' }],
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
  }

  /**
   * The action token the notification on screen is already carrying, if it belongs to this session.
   *
   * Minting revokes the session's previous token, so minting again on every launch would strand the
   * notification holding the old one. Adopting what is already there keeps it spendable and avoids
   * re-posting the notification just to swap in an identical-looking credential.
   */
  async readActionToken(sessionId: string): Promise<string | null> {
    const registration = await this.getRegistration();
    if (!registration) {
      return null;
    }

    const [existing] = await registration.getNotifications({ tag: SESSION_NOTIFICATION_TAG });
    const data = existing?.data as { sessionId?: string; token?: string } | undefined;
    return data?.sessionId === sessionId && typeof data.token === 'string' ? data.token : null;
  }

  async clear(): Promise<void> {
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

function matches(
  existing: Notification,
  sessionId: string,
  content: SessionNotificationContent,
  action?: SessionNotificationAction
): boolean {
  const data = existing.data as { sessionId?: string; setId?: string; token?: string } | undefined;
  return existing.title === content.title
    && existing.body === content.body
    && data?.sessionId === sessionId
    && data?.setId === action?.setId
    && data?.token === action?.token;
}
