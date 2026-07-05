import { Injectable, inject } from '@angular/core';
import { SwPush } from '@angular/service-worker';
import { Observable, filter, firstValueFrom, map } from 'rxjs';
import { UpsertPushSubscriptionCommand } from '@txg/shared';
import { PushService } from '@shared/api/push.service';
import { environment } from '../../../../environments/environment';

export type SessionNotificationAction = 'complete-set' | 'reset-timer';

const NOTIFICATION_TAG = 'session-active';
const ACTION_COMPLETE_SET: SessionNotificationAction = 'complete-set';
const ACTION_RESET_TIMER: SessionNotificationAction = 'reset-timer';

/**
 * Client side of the session notification feature. The notifications themselves
 * are delivered by the backend via Web Push (so they work while the app is
 * backgrounded); this service registers the device's push subscription, exposes
 * quick-action clicks, and closes the notification when a session ends.
 *
 * Everything degrades to a no-op when the service worker is disabled or the
 * Notification/Push APIs are unavailable (e.g. local dev, unsupported browsers).
 */
@Injectable({ providedIn: 'root' })
export class SessionNotificationService {
  private readonly swPush = inject(SwPush);
  private readonly pushService = inject(PushService);

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

  /**
   * Subscribes this device to Web Push and registers the subscription with the
   * API so the backend can deliver rest/idle alerts. No-op when unsupported,
   * unconfigured (no VAPID key), or permission is not granted.
   */
  async subscribeToPush(): Promise<void> {
    if (!this.isSupported || !environment.vapidPublicKey || Notification.permission !== 'granted') {
      return;
    }

    try {
      const subscription = await this.swPush.requestSubscription({ serverPublicKey: environment.vapidPublicKey });
      await firstValueFrom(this.pushService.saveSubscription(this.toCommand(subscription)));
    } catch (e) {
      console.error('Failed to subscribe to push notifications', e);
    }
  }

  /** Closes the ongoing session notification (e.g. when a session ends). */
  async clear(): Promise<void> {
    if (!this.isSupported) {
      return;
    }

    const registration = await navigator.serviceWorker.ready;
    const notifications = await registration.getNotifications({ tag: NOTIFICATION_TAG });
    notifications.forEach(notification => notification.close());
  }

  private toCommand(subscription: PushSubscription): UpsertPushSubscriptionCommand {
    const json = subscription.toJSON();
    return {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: json.keys?.['p256dh'] ?? '',
        auth: json.keys?.['auth'] ?? '',
      },
    };
  }
}
