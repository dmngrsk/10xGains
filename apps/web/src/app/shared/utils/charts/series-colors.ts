/**
 * The custom properties holding the categorical palette both charts draw from; the colors
 * themselves live in `styles.scss` next to the rest of the design tokens.
 *
 * Shared rather than declared per feature because the two chip rows sit on the same page and a
 * feature-local count drifts from the token list silently - the Body chart wrapped at eight for
 * exactly that reason, putting body weight and biceps on the same blue.
 */
export const SERIES_COLOR_TOKENS = Array.from(
  { length: 10 },
  (_, index) => `--txg-chart-series-${index + 1}`
);

/** The token a series at `index` draws in, wrapping once the palette runs out. */
export function seriesColorToken(index: number): string {
  return SERIES_COLOR_TOKENS[index % SERIES_COLOR_TOKENS.length];
}
