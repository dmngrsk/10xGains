import type { SessionSetDto } from '@txg/shared';
import { ConflictError } from '../../utils/errors';

/**
 * Asserts that a session set may be deleted.
 *
 * Two conditions, because deleting a set renumbers the ones that remain: completion pairs a
 * session's sets to the plan's by `set_index` and skips a planned set the session does not hold,
 * reading it as one the plan gained after the session started. A deleted set is indistinguishable
 * from that, so a set the plan prescribes can never go - whatever its status, and whatever it was
 * reset to first. Only a set added ad hoc mid-session, and only while still PENDING, may be removed.
 *
 * Which of the two a set is comes from the set itself. Deriving it from the plan's current set count
 * made the answer only as stable as the plan: shrinking an exercise's prescription reclassified an
 * already-recorded set as ad hoc and reopened it for deletion.
 *
 * @param {Pick<SessionSetDto, 'status' | 'set_index' | 'is_prescribed'>} set - The set to check.
 * @throws {ConflictError} If the set is prescribed by the plan, or has already been recorded.
 */
export function assertSessionSetDeletable(set: Pick<SessionSetDto, 'status' | 'set_index' | 'is_prescribed'>): void {
  if (set.is_prescribed) {
    throw new ConflictError(
      `A set the plan prescribes cannot be deleted. Remove set ${set.set_index} from the plan instead.`,
      'SESSION_SET_PRESCRIBED',
      'session_set_deletion_error',
      409
    );
  }

  if (set.status === 'PENDING') {
    return;
  }

  throw new ConflictError(
    `A set that has already been recorded cannot be deleted. Current status: ${set.status}. Reset it first.`,
    'SESSION_SET_NOT_DELETABLE',
    'session_set_deletion_error',
    409
  );
}

/**
 * Asserts that a session set's prescription may still be changed.
 *
 * Re-targeting a set you have not performed yet is an ordinary thing to do mid-workout. Re-targeting
 * one you have is not: completion judges `actual_reps` against `expected_reps`, so lowering the
 * target of a set already recorded would turn a failure into a success after the fact. Resetting the
 * set clears the record and reopens it, which costs the user the performance they are rewriting.
 *
 * @param {Pick<SessionSetDto, 'status'>} set - The set as it currently stands.
 * @throws {ConflictError} If the set has already been completed, failed, or skipped.
 */
export function assertSessionSetPrescriptionEditable(set: Pick<SessionSetDto, 'status'>): void {
  if (set.status === 'PENDING') {
    return;
  }

  throw new ConflictError(
    `The prescription of a set that has already been recorded cannot be changed. Current status: ${set.status}. Reset it first.`,
    'SESSION_SET_PRESCRIPTION_LOCKED',
    'session_set_update_error',
    409
  );
}
