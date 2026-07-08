import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ServerClockService } from './server-clock.service';

describe('ServerClockService', () => {
  let service: ServerClockService;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2023-01-01T00:00:00Z'));
    service = new ServerClockService();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return the local time when never synced', () => {
    expect(service.now()).toBe(Date.now());
  });

  it('should offset now() by the difference between server and local time', () => {
    // Server is 5s ahead of the (trailing) device clock.
    service.sync(new Date(Date.now() + 5000).toISOString());

    expect(service.now()).toBe(Date.now() + 5000);
  });

  it('should handle a server clock that is behind the device clock', () => {
    service.sync(new Date(Date.now() - 3000).toISOString());

    expect(service.now()).toBe(Date.now() - 3000);
  });

  it('should keep advancing with real time after syncing', () => {
    service.sync(new Date(Date.now() + 5000).toISOString());
    const before = service.now();

    vi.advanceTimersByTime(1000);

    expect(service.now()).toBe(before + 1000);
  });

  it('should accept epoch milliseconds and Date inputs', () => {
    service.sync(Date.now() + 2000);
    expect(service.now()).toBe(Date.now() + 2000);

    service.sync(new Date(Date.now() + 4000));
    expect(service.now()).toBe(Date.now() + 4000);
  });

  it('should ignore an invalid timestamp and keep the previous offset', () => {
    service.sync(new Date(Date.now() + 5000).toISOString());
    service.sync('not-a-date');

    expect(service.now()).toBe(Date.now() + 5000);
  });
});
