import type { SessionAlertMessage } from './session-alert.types';

const NOTIFICATION_TAG = 'session-active';
const NOTIFICATION_ICON = '/assets/favicon/web-app-manifest-192x192.png';
const VIBRATION_PATTERN = [400, 150, 400];

// ngsw reads `data.onActionClick[action]` to focus/open the app on click.
interface NgswActionClick {
  operation: 'focusLastFocusedOrOpen';
  url: string;
}

export interface SessionAlertNotification {
  title: string;
  body: string;
  tag: string;
  icon: string;
  requireInteraction: boolean;
  vibrate: number[];
  actions: { action: string; title: string }[];
  data: { onActionClick: Record<string, NgswActionClick> };
}

/**
 * Builds the Web Push `notification` payload for a session alert. ngsw's push
 * handler shows this directly, and the quick actions map back to the app via
 * `?action=` (mirrors the client-side action map).
 */
export function buildSessionAlertNotification(message: SessionAlertMessage): SessionAlertNotification {
  const isReminder = message.type === 'reminder';
  const url = `/sessions/${message.sessionId}`;

  return {
    title: isReminder ? 'Still training?' : 'Rest over',
    body: isReminder
      ? 'Log your next set to keep your session going.'
      : 'Time for your next set.',
    tag: NOTIFICATION_TAG,
    icon: NOTIFICATION_ICON,
    requireInteraction: true,
    vibrate: VIBRATION_PATTERN,
    actions: [
      { action: 'complete-set', title: 'Complete set' },
      { action: 'reset-timer', title: 'Stop timer' },
    ],
    data: {
      onActionClick: {
        default: { operation: 'focusLastFocusedOrOpen', url },
        'complete-set': { operation: 'focusLastFocusedOrOpen', url: `${url}?action=complete-set` },
        'reset-timer': { operation: 'focusLastFocusedOrOpen', url: `${url}?action=reset-timer` },
      },
    },
  };
}
