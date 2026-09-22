/**
 * Reads a Material system colour off the document root, for a canvas that cannot use CSS.
 *
 * Chart.js paints into a bitmap, so it takes colours as values rather than inheriting them. The
 * tokens are resolved at build time rather than hardcoded so the charts follow the app's theme;
 * the fallback covers server-side rendering and the moment before styles are applied, where
 * `document` is absent or the custom property resolves to an empty string.
 *
 * @param token The CSS custom property to read, e.g. `--mat-sys-on-surface-variant`.
 * @param fallback The colour to use when the token cannot be resolved.
 * @returns The resolved colour, or the fallback.
 */
export function getThemeColor(token: string, fallback: string): string {
  if (typeof document === 'undefined') {
    return fallback;
  }

  const value = getComputedStyle(document.documentElement).getPropertyValue(token).trim();

  return value || fallback;
}
