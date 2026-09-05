import { Injectable } from '@angular/core';

/** The text shown on the notification. */
export interface SessionNotificationContent {
  title: string;
  body: string;
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
 * closed or the installed app being swiped away - which is the whole point of it. `ngsw-worker`
 * handles the click natively through its `onActionClick` protocol, so no custom service worker is
 * needed to route back into the session.
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

  async show(sessionId: string, content: SessionNotificationContent): Promise<void> {
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
    if (existing && matches(existing, sessionId, content)) {
      return;
    }

    // `navigateLastFocusedOrOpen` focuses an already-open app and routes it to the session, and
    // opens a window at that route when nothing is running. Registered for the button and for a tap
    // on the notification body alike, since both should land in the same place.
    const openAction = { operation: 'navigateLastFocusedOrOpen', url: `sessions/${sessionId}` };

    const options: PersistentNotificationOptions = {
      body: content.body,
      tag: SESSION_NOTIFICATION_TAG,
      badge: SESSION_NOTIFICATION_BADGE,
      silent: true,
      requireInteraction: true,
      actions: [{ action: 'open', title: 'View session' }],
      data: {
        sessionId,
        onActionClick: { default: openAction, open: openAction },
      },
    };

    await registration.showNotification(content.title, options);
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

function matches(existing: Notification, sessionId: string, content: SessionNotificationContent): boolean {
  const data = existing.data as { sessionId?: string } | undefined;
  return existing.title === content.title
    && existing.body === content.body
    && data?.sessionId === sessionId;
}
