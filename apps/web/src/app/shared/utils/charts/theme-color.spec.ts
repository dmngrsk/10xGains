import { describe, expect, it } from 'vitest';
import { getThemeColor } from './theme-color';

describe('getThemeColor', () => {
  it('should resolve a custom property set on the document root', () => {
    document.documentElement.style.setProperty('--txg-test-color', '#123456');

    expect(getThemeColor('--txg-test-color', '#000')).toBe('#123456');

    document.documentElement.style.removeProperty('--txg-test-color');
  });

  // An unresolved token reads as an empty string, not as undefined.
  it('should fall back when the token is not set', () => {
    expect(getThemeColor('--txg-not-a-token', '#abcdef')).toBe('#abcdef');
  });
});
