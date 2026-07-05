import { describe, it, expect } from 'vitest';
import { shouldSendSessionAlert } from './push-sender';

describe('shouldSendSessionAlert', () => {
  it('sends when the session is in progress and there is no newer activity', () => {
    expect(shouldSendSessionAlert({ sessionStatus: 'IN_PROGRESS', hasNewerActivity: false })).toBe(true);
  });

  it('skips when the session is no longer in progress', () => {
    expect(shouldSendSessionAlert({ sessionStatus: 'COMPLETED', hasNewerActivity: false })).toBe(false);
    expect(shouldSendSessionAlert({ sessionStatus: 'CANCELLED', hasNewerActivity: false })).toBe(false);
    expect(shouldSendSessionAlert({ sessionStatus: null, hasNewerActivity: false })).toBe(false);
  });

  it('skips a stale alert when the user has logged something since it was scheduled', () => {
    expect(shouldSendSessionAlert({ sessionStatus: 'IN_PROGRESS', hasNewerActivity: true })).toBe(false);
  });
});
