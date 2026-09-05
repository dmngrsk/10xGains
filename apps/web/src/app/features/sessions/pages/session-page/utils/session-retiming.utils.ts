/** What finishing at a chosen instant would do to the times the session already carries. */
export interface SessionRetimingPreview {
  /** Recorded sets that move back onto the chosen end. */
  movedCount: number;
  /** Recorded sets that keep the time they were logged at. */
  keptCount: number;
  /** Where the session would start once retimed. */
  start: Date | null;
  /** The finish the session would record, which is the chosen end itself. */
  end: Date | null;
  /** How far back the block travels, in milliseconds; 0 when nothing moves. */
  shiftMs: number;
  /**
   * Whether any moved set was held at the floor rather than travelling the full shift.
   *
   * Happens when the late block spans further back than the space between the chosen end and the
   * last set that stayed: keeping the recorded order then costs those sets their spacing.
   */
  clamped: boolean;
}

/**
 * Previews the retiming the API would apply, so the picker can state the consequence before the
 * user commits to it.
 *
 * Mirrors `retimeSessionToEnd` on the server, which stays the source of truth: only the timestamps
 * recorded after the chosen end move, they all move by the same amount, and none of them lands
 * before a timestamp that stayed. The end is the chosen instant itself, because that is what the
 * session stores as its `finished_at` - whether or not any set had to move to fit behind it.
 *
 * @param sessionDate When the session started, if it has begun.
 * @param setTimestamps When each recorded set was completed or failed.
 * @param endAt The instant the user says training ended.
 * @returns What the session's times would become.
 */
export function previewSessionRetiming(
  sessionDate: Date | null,
  setTimestamps: Date[],
  endAt: Date
): SessionRetimingPreview {
  const endAtMs = endAt.getTime();
  const setTimes = setTimestamps.map(date => date.getTime());
  const allTimes = sessionDate ? [...setTimes, sessionDate.getTime()] : [...setTimes];

  if (allTimes.length === 0) {
    return { movedCount: 0, keptCount: 0, start: endAt, end: endAt, shiftMs: 0, clamped: false };
  }

  const lastActivityMs = Math.max(...allTimes);
  if (lastActivityMs <= endAtMs) {
    return {
      movedCount: 0,
      keptCount: setTimes.length,
      start: sessionDate ?? toDate(Math.min(...allTimes)),
      end: endAt,
      shiftMs: 0,
      clamped: false,
    };
  }

  const deltaMs = endAtMs - lastActivityMs;
  const floorMs = Math.max(...allTimes.filter(ms => ms <= endAtMs), Number.NEGATIVE_INFINITY);
  const shift = (ms: number): number => (ms > endAtMs ? Math.max(ms + deltaMs, floorMs) : ms);

  const shiftedSetTimes = setTimes.map(shift);

  return {
    movedCount: setTimes.filter(ms => ms > endAtMs).length,
    keptCount: setTimes.filter(ms => ms <= endAtMs).length,
    start: sessionDate ? toDate(shift(sessionDate.getTime())) : toDate(Math.min(...shiftedSetTimes)),
    end: endAt,
    shiftMs: -deltaMs,
    clamped: allTimes.some(ms => ms > endAtMs && ms + deltaMs < floorMs),
  };
}

/**
 * Renders a span of time the way the picker's preview reads it out, e.g. `23 h 55 min`.
 *
 * @param milliseconds The span to describe.
 * @returns The span in hours and minutes, or minutes alone when it is under an hour.
 */
export function formatRetimingShift(milliseconds: number): string {
  const totalMinutes = Math.round(Math.abs(milliseconds) / (1000 * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} h`;
  return `${hours} h ${minutes} min`;
}

function toDate(milliseconds: number): Date {
  return new Date(milliseconds);
}
