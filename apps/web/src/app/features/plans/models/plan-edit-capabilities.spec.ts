import { describe, it, expect } from 'vitest';
import { derivePlanEditCapabilities, PlanEditCapabilities, PlanEditState } from './plan-edit-capabilities';

const state = (overrides: Partial<PlanEditState> = {}): PlanEditState => ({
  isActive: false,
  sessionCount: 0,
  openSessionCount: 0,
  ...overrides,
});

describe('derivePlanEditCapabilities', () => {
  describe('the capability matrix', () => {
    it('should allow everything but archiving on a plan that has never been trained', () => {
      // Nothing references the structure, so a hard delete leaves nothing behind.
      expect(derivePlanEditCapabilities(state())).toEqual<PlanEditCapabilities>({
        canEditSetValues: true,
        canAddItems: true,
        canReorder: true,
        canDeleteStructure: true,
        canArchiveStructure: false,
        canEditPlanMetadata: true,
      });
    });

    it('should keep tuning available on a plan with history, and swap delete for archive', () => {
      // The central claim: history restricts deletion, not editing.
      expect(derivePlanEditCapabilities(state({ sessionCount: 14 }))).toEqual<PlanEditCapabilities>({
        canEditSetValues: true,
        canAddItems: true,
        canReorder: true,
        canDeleteStructure: false,
        canArchiveStructure: true,
        canEditPlanMetadata: true,
      });
    });

    it('should keep everything but deletion available while a session is open', () => {
      // Reordering included: it is a permutation of 1..n, and the verdict comes off the session's
      // own snapshot, so the same sets are judged on the same numbers either way.
      expect(derivePlanEditCapabilities(state({ sessionCount: 3, openSessionCount: 1 }))).toEqual<PlanEditCapabilities>({
        canEditSetValues: true,
        canAddItems: true,
        canReorder: true,
        canDeleteStructure: false,
        canArchiveStructure: true,
        canEditPlanMetadata: true,
      });
    });

    it('should permit nothing while the plan is the active one', () => {
      // Read-only until deactivated.
      expect(derivePlanEditCapabilities(state({ isActive: true, sessionCount: 14, openSessionCount: 1 }))).toEqual<PlanEditCapabilities>({
        canEditSetValues: false,
        canAddItems: false,
        canReorder: false,
        canDeleteStructure: false,
        canArchiveStructure: false,
        canEditPlanMetadata: false,
      });
    });
  });

  describe('a session that is open but not yet history', () => {
    // Activating a plan creates a PENDING session: absent from `sessionCount`, but its rows still
    // reference the structure, so the API's delete would fail on the foreign key.
    const activatedButUntrained = state({ sessionCount: 0, openSessionCount: 1 });

    it('should not offer a delete the server would refuse', () => {
      expect(derivePlanEditCapabilities(activatedButUntrained).canDeleteStructure).toBe(false);
    });

    it('should offer archiving in its place', () => {
      expect(derivePlanEditCapabilities(activatedButUntrained).canArchiveStructure).toBe(true);
    });

    it('should still allow reordering', () => {
      expect(derivePlanEditCapabilities(activatedButUntrained).canReorder).toBe(true);
    });

    it('should still allow tuning weights and reps', () => {
      expect(derivePlanEditCapabilities(activatedButUntrained).canEditSetValues).toBe(true);
    });
  });

  it('should offer reordering whenever the editor is editable at all', () => {
    // Session data references days and exercises by id, so history never makes reordering unsafe.
    const editable = [state(), state({ sessionCount: 1 }), state({ openSessionCount: 1 }), state({ sessionCount: 9, openSessionCount: 1 })];

    for (const input of editable) {
      expect(derivePlanEditCapabilities(input).canReorder).toBe(true);
    }
    expect(derivePlanEditCapabilities(state({ isActive: true })).canReorder).toBe(false);
  });

  it('should never offer both deleting and archiving, nor neither, while the plan is editable', () => {
    // Alternatives: exactly one must be live, or a user with history sees no way to remove anything.
    const cases = [state(), state({ sessionCount: 1 }), state({ openSessionCount: 1 }), state({ sessionCount: 2, openSessionCount: 1 })];

    for (const input of cases) {
      const { canDeleteStructure, canArchiveStructure } = derivePlanEditCapabilities(input);
      expect(canDeleteStructure).not.toBe(canArchiveStructure);
    }
  });
});
