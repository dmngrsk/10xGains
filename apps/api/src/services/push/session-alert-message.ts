import type { SessionAlertMessage, SessionAlertType } from './session-alert.types';

/** Parses and validates a queue message into a SessionAlertMessage, or null if malformed. */
export function parseSessionAlertMessage(queueItem: unknown): SessionAlertMessage | null {
  const raw = typeof queueItem === 'string' ? safeParse(queueItem) : queueItem;
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const message = raw as Record<string, unknown>;
  const type = message['type'];
  if (type !== 'rest-over' && type !== 'reminder') {
    return null;
  }
  if (
    typeof message['userId'] !== 'string' ||
    typeof message['sessionId'] !== 'string' ||
    typeof message['setId'] !== 'string' ||
    typeof message['scheduledFromIso'] !== 'string'
  ) {
    return null;
  }

  return {
    type: type as SessionAlertType,
    userId: message['userId'],
    sessionId: message['sessionId'],
    setId: message['setId'],
    scheduledFromIso: message['scheduledFromIso'],
  };
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
