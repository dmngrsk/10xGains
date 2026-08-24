/**
 * What the user may do to a plan, given what has already been trained from it.
 *
 * An active plan is read-only, and is edited by deactivating it first. Otherwise the question is
 * not "has this plan been used" but "would this edit change the meaning of something recorded".
 * Only deletion does: a session is judged against the `expected_reps` / `expected_weight` it
 * snapshotted, so editing, adding and reordering stay safe, while a day or exercise with history
 * has to be archived instead.
 */
export interface PlanEditCapabilities {
  canEditSetValues: boolean;
  canAddItems: boolean;
  /** Days and exercises only; sets are not reorderable. */
  canReorder: boolean;
  canDeleteStructure: boolean;
  canArchiveStructure: boolean;
  canEditPlanMetadata: boolean;
}

export interface PlanEditState {
  isActive: boolean;
  /** COMPLETED or IN_PROGRESS: what "has been trained" means. */
  sessionCount: number;
  /** PENDING or IN_PROGRESS. Not history, but still referencing the structure, so still blocks a delete. */
  openSessionCount: number;
}

const NOTHING_EDITABLE: PlanEditCapabilities = {
  canEditSetValues: false,
  canAddItems: false,
  canReorder: false,
  canDeleteStructure: false,
  canArchiveStructure: false,
  canEditPlanMetadata: false,
};

/** A pure function rather than a computed signal, so the whole matrix can be tested directly. */
export function derivePlanEditCapabilities(state: PlanEditState): PlanEditCapabilities {
  const { isActive, sessionCount, openSessionCount } = state;

  if (isActive) {
    return NOTHING_EDITABLE;
  }

  // Any session pointing at the plan blocks a delete, not only a completed one.
  const isReferenced = sessionCount > 0 || openSessionCount > 0;

  return {
    canEditSetValues: true,
    canAddItems: true,
    canReorder: true,
    canDeleteStructure: !isReferenced,
    canArchiveStructure: isReferenced,
    canEditPlanMetadata: true,
  };
}
