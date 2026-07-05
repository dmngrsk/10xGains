import { describe, it, expect } from 'vitest';
import { parseSessionAlertMessage } from './session-alert-message';

const valid = {
  type: 'rest-over',
  userId: 'u1',
  sessionId: 's1',
  setId: 'set1',
  scheduledFromIso: '2026-07-05T10:00:00.000Z',
};

describe('parseSessionAlertMessage', () => {
  it('parses a valid object message', () => {
    expect(parseSessionAlertMessage(valid)).toEqual(valid);
  });

  it('parses a valid JSON string message (base64-decoded by the host)', () => {
    expect(parseSessionAlertMessage(JSON.stringify(valid))).toEqual(valid);
  });

  it('rejects an unknown alert type', () => {
    expect(parseSessionAlertMessage({ ...valid, type: 'bogus' })).toBeNull();
  });

  it('rejects messages missing required fields', () => {
    expect(parseSessionAlertMessage({ type: 'reminder', userId: 'u1' })).toBeNull();
    expect(parseSessionAlertMessage('not json')).toBeNull();
    expect(parseSessionAlertMessage(null)).toBeNull();
  });
});
