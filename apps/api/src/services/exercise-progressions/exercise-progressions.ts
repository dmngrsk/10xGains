import { handleProportionalDeload } from './deload-strategies/proportional-deload';
import type { SessionSetDto, PlanExerciseDto, PlanExerciseProgressionDto, PlanExerciseSetDto } from '@txg/shared';

/**
 * Resolves exercise progressions based on completed session sets and current progression rules.
 *
 * This function compares the actual performed sets from a training session against the prescription
 * the session was created with - `session_sets.expected_reps` / `expected_weight`, snapshotted at
 * creation - rather than against the plan as it stands now. Based on whether all sets for an exercise
 * were successfully completed, it determines how the exercise progression should be updated (e.g.,
 * increase weight, deload). It also calculates the new set configurations (e.g., updated target
 * weights) for the next session, and those *are* computed from the live plan: the verdict belongs to
 * the session, the next targets belong to the plan.
 *
 * @param sessionSets - An array of `SessionSetDto` objects representing the sets performed during the
 *                       training session, each carrying the prescription it was created with.
 * @param planExercises - An array of `PlanExerciseDto` objects detailing the exercises planned for the session,
 *                        including their expected sets (`sets` property).
 * @param exerciseProgressions - An array of `PlanExerciseProgressionDto` objects representing the current
 *                               progression state for each exercise (e.g., deload rules, weight increment).
 * @returns An object containing two arrays:
 *          - `exerciseSetsToUpdate`: An array of `PlanExerciseSetDto` objects with updated targets for the next session.
 *          - `exerciseProgressionsToUpdate`: An array of `PlanExerciseProgressionDto` objects with updated progression states.
 */
export function resolveExerciseProgressions(
  sessionSets: SessionSetDto[],
  planExercises: PlanExerciseDto[],
  exerciseProgressions: PlanExerciseProgressionDto[]
): { exerciseSetsToUpdate: PlanExerciseSetDto[], exerciseProgressionsToUpdate: PlanExerciseProgressionDto[] } {
  const exerciseSetsToUpdate: PlanExerciseSetDto[] = [];
  const exerciseProgressionsToUpdate: PlanExerciseProgressionDto[] = [];

  const exerciseMap = Object.groupBy(planExercises, (planExercise) => planExercise.exercise_id);
  const progressionMap = new Map(exerciseProgressions.map(p => [p.exercise_id, p]));
  const actualPerformedExercises = new Set(sessionSets.map(ss => ss.plan_exercise_id));

  // `Object.groupBy` types its values as possibly absent, since it cannot know which keys exist.
  // A key only exists here because something was grouped under it, so the fallback never runs.
  for (const [exerciseId, group] of Object.entries(exerciseMap)) {
    const scopedPlanExercises = group ?? [];
    const currentSets = scopedPlanExercises.map(pe => pe.sets).flat().filter(s => !!s);
    const currentProgression = progressionMap.get(exerciseId);

    if (!currentProgression) {
      // Progressions are only created explicitly (PUT /plans/:planId/progressions/:exerciseId), so
      // an exercise added to an already-active plan has none. Failing here would abort the whole
      // completion with a 500 on an ordinary user path; instead leave this exercise's targets
      // untouched and progress the others.
      console.warn(`No exercise progression found for exercise ${exerciseId}. Leaving its sets unchanged.`);
      continue;
    }

    if (currentSets.length === 0) {
      console.warn(`No expected sets found for exercise ${exerciseId}. Skipping progression update.`);
      continue;
    }

    // An exercise is only judged on the sets the session was actually given. `judgedSetCount` is
    // tracked separately from `exerciseFound` so that an exercise whose every planned set post-dates
    // the session - all of them skipped below - can be left alone rather than judged on no evidence.
    let exerciseFound = false;
    let judgedSetCount = 0;
    let exerciseSetsSuccessful = true;

    for (const scopedPlanExercise of scopedPlanExercises) {
      if (actualPerformedExercises.has(scopedPlanExercise.id)) {
        exerciseFound = true;
        const expectedScopedPlanSets = scopedPlanExercise.sets || [];
        const actualPerformedSets = sessionSets.filter(ss => ss.plan_exercise_id === scopedPlanExercise.id) || [];

        for (const expectedSet of expectedScopedPlanSets) {
          const actualSet = actualPerformedSets.find(as => as.set_index === expectedSet.set_index);
          if (!actualSet) {
            // A set the session was never given cannot have been failed, so it is skipped rather
            // than counted against the exercise; the remaining sets still decide the outcome.
            //
            // Skipping rests on neither side of the match being removable: a session set the plan
            // prescribes cannot be deleted at any status (`assertSessionSetDeletable`) nor
            // repointed to another index, and a plan set cannot be deleted once anything has been
            // recorded against its exercise (`PlanRepository.deleteSet`). Were either removable,
            // this branch would also catch a set the user failed and then deleted, and would excuse
            // the failure that should have deloaded them.
            console.warn(`No actual set found for expected set with index ${expectedSet.set_index} of exercise ${exerciseId} (plan exercise ID: ${scopedPlanExercise.id}). It was added to the plan after the session started; skipping it.`);
            continue;
          }
          // Judged against the session's own snapshot, never against `expectedSet` - the live plan.
          judgedSetCount++;
          if (actualSet.status !== 'COMPLETED' || (actualSet.actual_reps ?? 0) < (actualSet.expected_reps ?? 0) || actualSet.actual_weight < actualSet.expected_weight) {
            exerciseSetsSuccessful = false;
            break;
          }
        }
      }
    }

    if (exerciseFound && judgedSetCount === 0) {
      // Falling through would take the failure branch and punish the user for editing their own
      // plan, so leave this exercise's targets and failure count exactly as they are.
      console.warn(`No session set matched any planned set of exercise ${exerciseId}; every planned set post-dates the session. Leaving its progression unchanged.`);
      continue;
    }

    const newSets: PlanExerciseSetDto[] = [];
    const newProgression = { ...currentProgression, last_updated: new Date().toISOString() } as PlanExerciseProgressionDto;
    const exerciseSuccessful = exerciseFound && exerciseSetsSuccessful;

    const progressWeight = (set: PlanExerciseSetDto) => {
      return { ...set, expected_weight: set.expected_weight + currentProgression.weight_increment };
    };

    const deloadWeight = (set: PlanExerciseSetDto): PlanExerciseSetDto => {
      const strategy = currentProgression.deload_strategy || 'PROPORTIONAL';
      switch (strategy) {
        case 'PROPORTIONAL':
          return handleProportionalDeload(set, currentProgression);
        default:
          throw new Error(`Unsupported deload strategy: '${strategy}' for exercise ${exerciseId}.`);
      }
    };

    if (exerciseSuccessful) {
      newSets.push(...currentSets.map(progressWeight));
      newProgression.consecutive_failures = 0;
    } else {
      const newConsecutiveFailures = (newProgression.consecutive_failures ?? 0) + 1;
      if (newConsecutiveFailures >= newProgression.failure_count_for_deload) {
        newSets.push(...currentSets.map(deloadWeight));
        newProgression.consecutive_failures = 0;
      } else {
        newSets.push(...currentSets);
        newProgression.consecutive_failures = newConsecutiveFailures;
      }
    }

    exerciseSetsToUpdate.push(...newSets);
    exerciseProgressionsToUpdate.push(newProgression as PlanExerciseProgressionDto);
  }

  return { exerciseSetsToUpdate, exerciseProgressionsToUpdate };
}
