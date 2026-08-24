import type { SessionSetDto } from '@txg/shared';
import { describe, it, expect } from 'vitest';
import { ConflictError } from '../../utils/errors';
import { assertSessionSetDeletable, assertSessionSetPrescriptionEditable } from './session-sets';

const RECORDED_STATUSES = ['COMPLETED', 'FAILED', 'SKIPPED'] as const satisfies readonly SessionSetDto['status'][];

const adHoc = (status: SessionSetDto['status']) => ({ status, set_index: 4, is_prescribed: false });
const prescribed = (status: SessionSetDto['status']) => ({ status, set_index: 3, is_prescribed: true });

describe('assertSessionSetDeletable', () => {
  it('should allow deleting an ad hoc set nothing has been recorded against', () => {
    expect(() => assertSessionSetDeletable(adHoc('PENDING'))).not.toThrow();
  });

  it.each(RECORDED_STATUSES)('should refuse to delete a %s ad hoc set', (status) => {
    expect(() => assertSessionSetDeletable(adHoc(status))).toThrow(ConflictError);
  });

  it.each(['PENDING', ...RECORDED_STATUSES] as const)('should refuse to delete a prescribed set, %s or not', (status) => {
    // Whatever its status. Completion reads a planned set the session does not hold as one the plan
    // gained after the session started and skips it, so a deleted set is indistinguishable from one
    // that was never prescribed - and the failure it recorded goes with it.
    expect(() => assertSessionSetDeletable(prescribed(status))).toThrow(ConflictError);
  });

  it('should close the reset-then-delete route out of a failure', () => {
    // The hole this guard exists for. Resetting is supported (`PATCH .../reset`), so status alone
    // never established that a set had not been recorded: fail set 3, reset it to PENDING, delete
    // it, and the exercise progresses instead of deloading. Being prescribed is what refuses it.
    expect(() => assertSessionSetDeletable(prescribed('PENDING')))
      .toThrow('A set the plan prescribes cannot be deleted. Remove set 3 from the plan instead.');
  });

  it('should keep refusing a prescribed set after the plan has been shrunk under it', () => {
    // The set carries the answer, so the plan is free to move afterwards. While this was inferred
    // from the plan's current set count, editing an exercise from three sets down to two put set 3
    // outside the count and handed the user back the deletion the guard above refuses.
    const setTheUserAlreadyFailed = { status: 'FAILED' as const, set_index: 3, is_prescribed: true };

    expect(() => assertSessionSetDeletable(setTheUserAlreadyFailed)).toThrow(ConflictError);
  });

  it('should refuse with a 409 the client can act on', () => {
    try {
      assertSessionSetDeletable(adHoc('FAILED'));
      expect.unreachable('Expected a ConflictError for a FAILED set.');
    } catch (e) {
      const error = e as ConflictError;
      expect(error.status).toBe(409);
      expect(error.code).toBe('SESSION_SET_NOT_DELETABLE');
      expect(error.message).toContain('FAILED');
      expect(error.message).toContain('Reset it first');
    }
  });
});

describe('assertSessionSetPrescriptionEditable', () => {
  it('should allow re-targeting a set the user has not performed yet', () => {
    // An ordinary thing to do mid-workout: today's set is going to be seven reps, not five.
    expect(() => assertSessionSetPrescriptionEditable({ status: 'PENDING' })).not.toThrow();
  });

  it.each(RECORDED_STATUSES)('should refuse to re-target a %s set', (status) => {
    // Completion judges `actual_reps` against `expected_reps`, so lowering the target of a set
    // already recorded turns a failure into a success after the fact.
    expect(() => assertSessionSetPrescriptionEditable({ status })).toThrow(ConflictError);
  });

  it('should refuse with a 409 naming the way through', () => {
    try {
      assertSessionSetPrescriptionEditable({ status: 'FAILED' });
      expect.unreachable('Expected a ConflictError for a FAILED set.');
    } catch (e) {
      const error = e as ConflictError;
      expect(error.status).toBe(409);
      expect(error.code).toBe('SESSION_SET_PRESCRIPTION_LOCKED');
      expect(error.message).toContain('Reset it first');
    }
  });
});
