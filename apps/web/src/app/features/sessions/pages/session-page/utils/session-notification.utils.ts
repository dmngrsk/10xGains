import { SessionNotificationContent } from '@shared/services/session-notification.service';
import { SessionExerciseViewModel, SessionPageViewModel, SessionSetViewModel } from '../../../models/session-page.viewmodel';

/** The next set the user is expected to work through, with its position among that exercise's sets. */
export interface NextSessionSet {
  exercise: SessionExerciseViewModel;
  set: SessionSetViewModel;
  setNumber: number;
  setCount: number;
}

/**
 * The first set still waiting to be performed: exercises by their order, then sets within one.
 * Warmup sets live outside `exercise.sets`, so they are out of scope here.
 */
export function findNextPendingSet(session: SessionPageViewModel): NextSessionSet | null {
  const exercises = [...session.exercises].sort((a, b) => a.order - b.order);

  for (const exercise of exercises) {
    const sets = [...exercise.sets].sort((a, b) => a.order - b.order);
    const index = sets.findIndex(set => set.status === 'PENDING');
    if (index > -1) {
      return { exercise, set: sets[index], setNumber: index + 1, setCount: sets.length };
    }
  }

  return null;
}

/** `8 reps @ 60 kg`, matching `SessionExerciseItemComponent.exerciseInfoText`. */
export function formatSetDescription(set: SessionSetViewModel): string {
  const repsText = `${set.expectedReps} reps`;
  return set.weight ? `${repsText} @ ${set.weight} kg` : repsText;
}

/** The notification text for a session in progress. Sets are numbered within their exercise. */
export function buildSessionNotificationContent(session: SessionPageViewModel): SessionNotificationContent {
  const next = findNextPendingSet(session);
  if (!next) {
    return { title: 'Workout in progress', body: 'All sets done - tap to finish' };
  }

  return {
    title: next.exercise.exerciseName,
    body: `Set ${next.setNumber}/${next.setCount} · ${formatSetDescription(next.set)}`,
  };
}
