import { describe, expect, it } from 'vitest';
import { formatRetimingShift, previewSessionRetiming } from './session-retiming.utils';

const at = (iso: string): Date => new Date(iso);

describe('previewSessionRetiming', () => {
  it('should move every set of a wholly late-logged session', () => {
    const preview = previewSessionRetiming(
      at('2026-06-02T08:00:00.000Z'),
      [at('2026-06-02T08:00:00.000Z'), at('2026-06-02T08:03:00.000Z'), at('2026-06-02T08:05:00.000Z')],
      at('2026-06-01T19:30:00.000Z')
    );

    expect(preview.movedCount).toBe(3);
    expect(preview.keptCount).toBe(0);
    expect(preview.start).toEqual(at('2026-06-01T19:25:00.000Z'));
    expect(preview.end).toEqual(at('2026-06-01T19:30:00.000Z'));
  });

  it('should move only the set marked after the chosen end', () => {
    const preview = previewSessionRetiming(
      at('2026-06-01T18:00:00.000Z'),
      [at('2026-06-01T18:00:00.000Z'), at('2026-06-01T19:25:00.000Z'), at('2026-06-02T08:30:00.000Z')],
      at('2026-06-01T19:30:00.000Z')
    );

    expect(preview.movedCount).toBe(1);
    expect(preview.keptCount).toBe(2);
    expect(preview.start).toEqual(at('2026-06-01T18:00:00.000Z'));
    expect(preview.end).toEqual(at('2026-06-01T19:30:00.000Z'));
  });

  it('should report that nothing moves when the end is after everything recorded', () => {
    const preview = previewSessionRetiming(
      at('2026-06-01T18:00:00.000Z'),
      [at('2026-06-01T19:25:00.000Z')],
      at('2026-06-01T19:30:00.000Z')
    );

    expect(preview.movedCount).toBe(0);
    expect(preview.keptCount).toBe(1);
    // The session records the chosen end even when no set had to move to fit behind it.
    expect(preview.end).toEqual(at('2026-06-01T19:30:00.000Z'));
  });

  it('should keep a moved set behind one that stayed, and report the spacing it cost', () => {
    const preview = previewSessionRetiming(
      at('2026-06-01T19:00:00.000Z'),
      [at('2026-06-01T19:25:00.000Z'), at('2026-06-02T08:00:00.000Z'), at('2026-06-02T08:30:00.000Z')],
      at('2026-06-01T19:30:00.000Z')
    );

    expect(preview.movedCount).toBe(2);
    expect(preview.start).toEqual(at('2026-06-01T19:00:00.000Z'));
    expect(preview.end).toEqual(at('2026-06-01T19:30:00.000Z'));
    // The 08:00 set would land at 19:00, before the 19:25 set that stayed, so it is held back.
    expect(preview.clamped).toBe(true);
  });

  it('should report the shift, and no clamping, when the whole session moves together', () => {
    const preview = previewSessionRetiming(
      at('2026-06-02T08:00:00.000Z'),
      [at('2026-06-02T08:00:00.000Z'), at('2026-06-02T08:05:00.000Z')],
      at('2026-06-01T19:30:00.000Z')
    );

    expect(preview.shiftMs).toBe(12 * 60 * 60 * 1000 + 35 * 60 * 1000);
    expect(preview.clamped).toBe(false);
  });

  it('should fall back to the chosen end for a session with nothing recorded', () => {
    const preview = previewSessionRetiming(null, [], at('2026-06-01T19:30:00.000Z'));

    expect(preview).toEqual({
      movedCount: 0,
      keptCount: 0,
      start: at('2026-06-01T19:30:00.000Z'),
      end: at('2026-06-01T19:30:00.000Z'),
      shiftMs: 0,
      clamped: false,
    });
  });
});

describe('formatRetimingShift', () => {
  it.each([
    [5 * 60 * 1000, '5 min'],
    [2 * 60 * 60 * 1000, '2 h'],
    [(23 * 60 + 55) * 60 * 1000, '23 h 55 min'],
    [-(2 * 60 + 22) * 60 * 1000, '2 h 22 min'],
  ])('should render %p as %p', (milliseconds, expected) => {
    expect(formatRetimingShift(milliseconds)).toBe(expected);
  });
});
