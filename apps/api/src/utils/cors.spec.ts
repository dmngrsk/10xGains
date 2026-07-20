import { describe, it, expect, afterEach } from 'vitest';
import { resolveAllowedOrigins } from './cors';

describe('resolveAllowedOrigins', () => {
  const originalAppUrl = process.env['APP_URL'];

  afterEach(() => {
    if (originalAppUrl === undefined) {
      delete process.env['APP_URL'];
      return;
    }
    process.env['APP_URL'] = originalAppUrl;
  });

  it('should default to the local dev server, trusting both loopback spellings', () => {
    delete process.env['APP_URL'];

    expect(resolveAllowedOrigins()).toEqual(['http://localhost:4200', 'http://127.0.0.1:4200']);
  });

  it.each([
    ['http://localhost:4200', ['http://localhost:4200', 'http://127.0.0.1:4200']],
    ['http://127.0.0.1:4200', ['http://127.0.0.1:4200', 'http://localhost:4200']],
  ])('should add the loopback alias for %s, which browsers treat as a distinct origin', (appUrl, expected) => {
    process.env['APP_URL'] = appUrl;

    expect(resolveAllowedOrigins()).toEqual(expected);
  });

  it('should allow only the single origin for a deployed host', () => {
    process.env['APP_URL'] = 'https://app.example.com';

    expect(resolveAllowedOrigins()).toEqual(['https://app.example.com']);
  });

  it('should reduce a URL with a path to its origin', () => {
    process.env['APP_URL'] = 'https://app.example.com/some/path?q=1';

    expect(resolveAllowedOrigins()).toEqual(['https://app.example.com']);
  });

  it.each(['not-a-url', '', 'http://'])('should throw at startup for the unparseable value %p', (appUrl) => {
    // Returning it verbatim produced an allowlist matching nothing: every browser request failed
    // CORS while the API looked healthy, so the misconfiguration surfaced only in the client.
    process.env['APP_URL'] = appUrl;

    expect(() => resolveAllowedOrigins()).toThrow(/APP_URL is not a valid URL/);
  });
});
