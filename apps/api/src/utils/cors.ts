/**
 * CORS origin allowlist from `APP_URL`. In local dev it also trusts the loopback alias
 * (localhost <-> 127.0.0.1), which browsers treat as a distinct origin; non-loopback hosts
 * get no alias, keeping CORS locked to the single `APP_URL`.
 */
export function resolveAllowedOrigins(): string[] {
  const appUrl = process.env['APP_URL'] ?? 'http://localhost:4200';

  let url: URL;
  try {
    url = new URL(appUrl);
  } catch {
    return [appUrl];
  }

  const aliasHostname =
    url.hostname === 'localhost' ? '127.0.0.1' :
    url.hostname === '127.0.0.1' ? 'localhost' :
    null;

  if (!aliasHostname) {
    return [url.origin];
  }

  const aliasUrl = new URL(appUrl);
  aliasUrl.hostname = aliasHostname;
  return [url.origin, aliasUrl.origin];
}
