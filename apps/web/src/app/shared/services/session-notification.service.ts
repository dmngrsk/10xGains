import { Injectable } from '@angular/core';

/** The text shown on the notification. Composed by the caller, which knows about sessions. */
export interface SessionNotificationContent {
  title: string;
  body: string;
}

/**
 * A fixed tag means a new notification replaces the one already on screen rather than stacking a
 * second one, and gives us a handle to close it by later.
 */
export const SESSION_NOTIFICATION_TAG = 'active-session';

const SESSION_NOTIFICATION_ICON = '/assets/favicon/web-app-manifest-192x192.png';

/**
 * Keeps a notification on screen for as long as a session is in progress, so the next set is
 * readable without unlocking the phone.
 *
 * The notification belongs to the service worker registration rather than to a page, so it outlives
 * the tab being closed or the installed app being swiped away - which is the whole point of it.
 * `ngsw-worker` handles the click natively through the `onActionClick` protocol, so no custom
 * service worker is needed to navigate back into the session.
 */
@Injectable({
  providedIn: 'root',
})
export class SessionNotificationService {
  private lastShownKey: string | null = null;

  /**
   * Anything left over from a session that was killed mid-workout, completed on another device, or
   * abandoned is cleared on startup; a session that really is in progress re-shows its notification
   * as soon as it loads. That is cheaper and more reliable than persisting state to reconcile
   * against, and the flicker is invisible because it only happens while the app is being opened.
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

  async show(sessionId: string, content: SessionNotificationContent): Promise<void> {
    if (!this.isSupported() || Notification.permission !== 'granted') {
      return;
    }

    // Callers re-derive this from session state on every change, most of which do not affect the
    // text. Re-showing an identical notification would keep bumping it back to the top of the
    // notification shade for no reason.
    const key = `${sessionId}|${content.title}|${content.body}`;
    if (key === this.lastShownKey) {
      return;
    }

    const registration = await this.getRegistration();
    if (!registration) {
      return;
    }

    // `navigateLastFocusedOrOpen` focuses an already-open app and routes it to the session, and
    // opens a new window at that route when nothing is running. The URL is resolved against the
    // service worker's scope, so it stays relative here.
    await registration.showNotification(content.title, {
      body: content.body,
      tag: SESSION_NOTIFICATION_TAG,
      icon: SESSION_NOTIFICATION_ICON,
      silent: true,
      requireInteraction: true,
      data: {
        sessionId,
        onActionClick: {
          default: { operation: 'navigateLastFocusedOrOpen', url: `sessions/${sessionId}` },
        },
      },
    });

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
