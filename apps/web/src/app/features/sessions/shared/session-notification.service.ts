import { Injectable, inject } from '@angular/core';
import { SwPush } from '@angular/service-worker';
import { Observable, filter, map } from 'rxjs';

export type SessionNotificationAction = 'complete-set' | 'reset-timer';

export interface SessionNotificationContent {
  sessionId: string;
  title: string;
  exerciseName: string;
  reps: number;
  weight?: number | null;
}

// Operations understood by Angular's ngsw `notificationclick` handler, read
// from `notification.data.onActionClick[action]` to focus/open the app.
type NgswClickOperation = 'openWindow' | 'focusLastFocusedOrOpen' | 'navigateLastFocusedOrOpen' | 'sendRequest';
interface NgswActionClick {
  operation: NgswClickOperation;
  url: string;
}

// `actions`, `vibrate` and `renotify` are part of the Service Worker
// notification spec but not always present on the DOM `NotificationOptions` type.
interface NotificationActionButton {
  action: string;
  title: string;
  icon?: string;
}
interface OngoingNotificationOptions extends NotificationOptions {
  actions?: NotificationActionButton[];
  vibrate?: number[];
  renotify?: boolean;
}

const NOTIFICATION_TAG = 'session-active';
const NOTIFICATION_ICON = '/assets/favicon/web-app-manifest-192x192.png';
const REMINDER_INTERVAL_MS = 15 * 60 * 1000; // buzz every 15 min of inactivity
const REMINDER_VIBRATION_PATTERN = [400, 150, 400];
const ACTION_COMPLETE_SET: SessionNotificationAction = 'complete-set';
const ACTION_RESET_TIMER: SessionNotificationAction = 'reset-timer';

/**
 * Manages the OS-level ongoing notification shown while a workout session is
 * active: it displays the current set, offers quick actions, and periodically
 * re-alerts the user to keep logging so sessions are not left open.
 *
 * Everything degrades to a no-op when the service worker is disabled or the
 * Notification API is unavailable (e.g. local dev, unsupported browsers).
 */
@Injectable({ providedIn: 'root' })
export class SessionNotificationService {
  private readonly swPush = inject(SwPush);

  private lastContent: SessionNotificationContent | null = null;
  private reminderTimeoutId: ReturnType<typeof setTimeout> | null = null;

  /** Emits when the user taps a quick action while the app is in the foreground. */
  readonly actions$: Observable<SessionNotificationAction> = this.swPush.notificationClicks.pipe(
    map(event => event.action),
    filter((action): action is SessionNotificationAction =>
      action === ACTION_COMPLETE_SET || action === ACTION_RESET_TIMER),
  );

  get isSupported(): boolean {
    return this.swPush.isEnabled
      && typeof Notification !== 'undefined'
      && typeof navigator !== 'undefined'
      && !!navigator.serviceWorker;
  }

  /** Requests notification permission if not already decided. */
  async requestPermission(): Promise<NotificationPermission> {
    if (!this.isSupported) {
      return 'denied';
    }
    if (Notification.permission !== 'default') {
      return Notification.permission;
    }
    try {
      return await Notification.requestPermission();
    } catch {
      return 'denied';
    }
  }

  /** Shows or refreshes the ongoing notification and (re)arms the inactivity reminder. */
  async show(content: SessionNotificationContent): Promise<void> {
    if (!this.isSupported) {
      return;
    }

    this.lastContent = content;
    this.restartReminder();
    await this.render(content, { reAlert: false });
  }

  /** Clears the notification and stops the inactivity reminder. */
  async clear(): Promise<void> {
    this.stopReminder();
    this.lastContent = null;

    if (!this.isSupported) {
      return;
    }

    const registration = await navigator.serviceWorker.ready;
    const notifications = await registration.getNotifications({ tag: NOTIFICATION_TAG });
    notifications.forEach(notification => notification.close());
  }

  private async render(content: SessionNotificationContent, opts: { reAlert: boolean }): Promise<void> {
    if (!this.isSupported || Notification.permission !== 'granted') {
      return;
    }

    const registration = await navigator.serviceWorker.ready;
    const options: OngoingNotificationOptions = {
      tag: NOTIFICATION_TAG,
      icon: NOTIFICATION_ICON,
      body: this.buildBody(content),
      requireInteraction: true,
      silent: !opts.reAlert,
      renotify: opts.reAlert,
      vibrate: opts.reAlert ? REMINDER_VIBRATION_PATTERN : undefined,
      actions: [
        { action: ACTION_COMPLETE_SET, title: 'Complete set' },
        { action: ACTION_RESET_TIMER, title: 'Stop timer' },
      ],
      data: { onActionClick: this.buildActionMap(content.sessionId) },
    };

    await registration.showNotification(content.title, options);
  }

  private buildBody(content: SessionNotificationContent): string {
    const parts = [content.exerciseName];
    if (content.weight != null) {
      parts.push(`${content.weight} kg`);
    }
    parts.push(`${content.reps} reps`);
    return parts.join(' · ');
  }

  private buildActionMap(sessionId: string): Record<string, NgswActionClick> {
    const url = `/sessions/${sessionId}`;
    return {
      default: { operation: 'focusLastFocusedOrOpen', url },
      [ACTION_COMPLETE_SET]: { operation: 'focusLastFocusedOrOpen', url: `${url}?action=${ACTION_COMPLETE_SET}` },
      [ACTION_RESET_TIMER]: { operation: 'focusLastFocusedOrOpen', url: `${url}?action=${ACTION_RESET_TIMER}` },
    };
  }

  private restartReminder(): void {
    this.stopReminder();
    this.reminderTimeoutId = setTimeout(() => this.fireReminder(), REMINDER_INTERVAL_MS);
  }

  private stopReminder(): void {
    if (this.reminderTimeoutId) {
      clearTimeout(this.reminderTimeoutId);
      this.reminderTimeoutId = null;
    }
  }

  private async fireReminder(): Promise<void> {
    if (this.lastContent) {
      await this.render(this.lastContent, { reAlert: true });
    }
    this.restartReminder();
  }
}
