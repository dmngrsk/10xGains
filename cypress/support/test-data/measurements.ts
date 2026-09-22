/**
 * The body-measurement fixture data, in one place.
 *
 * Mirrors `exercises.ts`: the seeder in `scaffold.ts` and the specs in `e2e/measurements` both
 * read their measurement data from here, so what gets written and what gets asserted cannot
 * drift apart. The history generator lives here rather than in `scaffold.ts` for the same
 * reason - `generateSessionHistory` stays there because only the seeder ever needs it, while
 * this is needed by both.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

const pad = (value: number): string => String(value).padStart(2, '0');

/** A `YYYY-MM-DD` day, taken from the local clock the way the app takes it. */
export function calendarDate(daysAgo = 0): string {
  const date = new Date(Date.now() - daysAgo * DAY_MS);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * A birth date that makes the user exactly `age` today, whenever today is.
 *
 * Five days clear of the birthday, so a round seeded a day or two back is still the same age. A
 * fixed date would have been a time bomb: an expected percentage depends on an age term, so it
 * would have started failing on the first birthday after the date was written.
 */
function birthDateForAge(age: number): string {
  const date = new Date();
  date.setFullYear(date.getFullYear() - age);
  date.setDate(date.getDate() - 5);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// ---------------------------------------------------------------------------------------------
// The scaffolded history: what a user who has been measuring for six months looks like.
// ---------------------------------------------------------------------------------------------

/**
 * The body-composition profile the scaffolded rounds are read through.
 *
 * US Navy rather than a caliper method: it is the one that reads a tape, which is what most
 * people own, and its inputs (neck, waist) are among the rounds below - so the Body tab shows a
 * derived estimate rather than only what was typed in. The cadence is deliberately unset: a
 * cadence would put the overdue prompt on the home page once the fixture aged past it, and this
 * data is seeded once and then reused for days.
 */
export const SCAFFOLD_BODY_COMPOSITION = {
  heightCm: 183,
  sex: 'MALE',
  method: 'NAVY',
  frequencyDays: null,
  dateOfBirth: birthDateForAge(32),
};

/** How many weekly rounds the history holds - six months, so every date-range preset has data. */
const SCAFFOLD_ROUNDS = 26;

/**
 * What is measured, and where each type starts and ends over the window.
 *
 * A cut: weight and the circumferences fall, the neck barely moves. The tuple is
 * `[type, first, last, precision]`, interpolated linearly across the rounds, so the chart shows a
 * trend rather than noise. Chest and biceps are here without feeding any formula, because a real
 * user tracks things for their own sake and the chip row should show that.
 */
const SCAFFOLD_MEASURED_TYPES: [string, number, number, number][] = [
  ['BODY_WEIGHT', 88.6, 79.2, 1],
  ['NECK', 39.6, 38.2, 1],
  ['CHEST', 104.5, 101.0, 1],
  ['WAIST', 101.8, 88.9, 1],
  ['BICEPS', 35.8, 36.4, 1],
];

/** The types the scaffolded user tracks, which is exactly what it has been measuring. */
export const SCAFFOLD_TRACKED_TYPES = SCAFFOLD_MEASURED_TYPES.map(([type]) => type);

/**
 * Weekly rounds of body measurements, counting back from today.
 *
 * Every round is a full one: the carry-forward rule means a partial round still estimates, but a
 * fixture that exercised it would make the chart's hollow "carried forward" points the norm
 * rather than the exception they are meant to flag.
 *
 * @param {string} userId - The owner of the rows.
 * @returns {Record<string, unknown>[]} Rows ready to insert into `measurements`.
 */
export function generateMeasurementHistory(userId: string): Record<string, unknown>[] {
  const measurements: Record<string, unknown>[] = [];

  for (let round = 0; round < SCAFFOLD_ROUNDS; round++) {
    // Counted back from today, so the newest round is always current however old the fixture is.
    const measuredOn = calendarDate((SCAFFOLD_ROUNDS - 1 - round) * 7);
    const progress = round / (SCAFFOLD_ROUNDS - 1);

    for (const [type, first, last, precision] of SCAFFOLD_MEASURED_TYPES) {
      // A little shaped wobble on top of the trend: a body does not move in a straight line, and
      // a perfectly smooth chart hides whether the renderer is drawing points or interpolating.
      const wobble = Math.sin(round * 1.7) * (last - first) * 0.04;
      const value = first + (last - first) * progress + wobble;

      measurements.push({
        id: crypto.randomUUID(),
        user_id: userId,
        measured_on: measuredOn,
        type,
        value: Number(value.toFixed(precision)),
      });
    }
  }

  return measurements;
}

// ---------------------------------------------------------------------------------------------
// The worked examples the specs assert against.
// ---------------------------------------------------------------------------------------------

/**
 * The published examples the body-fat coefficients are pinned to.
 *
 * Asserted end to end rather than only in the API's unit tests, so the number proves it survives
 * the trip through the API, the chart mapping and Chart.js - not just the formula.
 */

/** A 183 cm man with a 38.6 cm neck and a 102.1 cm waist is 26.8% body fat. */
export const NAVY_EXAMPLE = { height: 183, neck: 38.6, waist: 102.1, expected: '26.8' };

/** Seven caliper sites summing to 94 mm at age 32 is 14.0%. */
export const JP_EXAMPLE = {
  dateOfBirth: birthDateForAge(32),
  expected: '14.0',
  sites: [
    ['SKINFOLD_CHEST', 12],
    ['SKINFOLD_MIDAXILLARY', 9],
    ['SKINFOLD_TRICEPS', 11],
    ['SKINFOLD_SUBSCAPULAR', 13],
    ['SKINFOLD_ABDOMEN', 20],
    ['SKINFOLD_SUPRAILIAC', 14],
    ['SKINFOLD_THIGH', 15],
  ] as [string, number][],
};

/** A figure typed in off a scale, for the one method that stores rather than derives one. */
export const MANUAL_BODY_FAT = '18.4';
