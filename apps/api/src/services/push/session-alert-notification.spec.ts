import { describe, it, expect } from 'vitest';
import { buildSessionAlertNotification } from './session-alert-notification';
import type { SessionAlertMessage } from './session-alert.types';

const base: SessionAlertMessage = {
  type: 'rest-over',
  userId: 'u1',
  sessionId: 'sess-1',
  setId: 'set-1',
  scheduledFromIso: '2026-07-05T10:00:00.000Z',
};

describe('buildSessionAlertNotification', () => {
  it('builds a rest-over notification with quick actions bound to the session', () => {
    const notification = buildSessionAlertNotification(base);

    expect(notification.title).toBe('Rest over');
    expect(notification.tag).toBe('session-active');
    expect(notification.requireInteraction).toBe(true);
    expect(notification.actions.map(a => a.action)).toEqual(['complete-set', 'reset-timer']);
    expect(notification.data.onActionClick['complete-set'].url).toBe('/sessions/sess-1?action=complete-set');
    expect(notification.data.onActionClick['default'].url).toBe('/sessions/sess-1');
  });

  it('builds a distinct reminder notification', () => {
    const notification = buildSessionAlertNotification({ ...base, type: 'reminder' });
    expect(notification.title).toBe('Still training?');
  });
});
