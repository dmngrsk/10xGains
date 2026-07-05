import { enqueueSessionAlert } from './session-alert-queue';

// Rest thresholds (seconds) after which the "rest over" alert fires, plus the
// idle reminder cadence that keeps sessions from being left open.
export const REST_OVER_COMPLETE_SECONDS = 2 * 60;
export const REST_OVER_FAIL_SECONDS = 5 * 60;
const REMINDER_SECONDS = 15 * 60;

/**
 * Schedules the delayed rest-over and idle-reminder alerts for a set that was
 * just completed/failed. Best-effort: a queue failure must never break the
 * originating request, so errors are swallowed here.
 */
export async function scheduleRestAlerts(
  userId: string,
  sessionId: string,
  setId: string,
  restOverSeconds: number
): Promise<void> {
  const scheduledFromIso = new Date().toISOString();
  const base = { userId, sessionId, setId, scheduledFromIso };

  try {
    await Promise.all([
      enqueueSessionAlert({ ...base, type: 'rest-over' }, restOverSeconds),
      enqueueSessionAlert({ ...base, type: 'reminder' }, REMINDER_SECONDS),
    ]);
  } catch (e) {
    console.error('Failed to schedule session alerts', e);
  }
}
