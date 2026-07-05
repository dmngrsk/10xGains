import { SessionExerciseViewModel, SessionPageViewModel, SessionSetViewModel } from './session-page.viewmodel';

export interface CurrentSetSelection {
  exercise: SessionExerciseViewModel;
  set: SessionSetViewModel;
}

/**
 * The next set the user should perform: the first `PENDING` set (by order)
 * within the first exercise (by order) that still has a pending set. Returns
 * null when every set has been completed/failed/skipped.
 */
export function selectCurrentSet(viewModel: SessionPageViewModel): CurrentSetSelection | null {
  const exercises = [...viewModel.exercises].sort((a, b) => a.order - b.order);

  for (const exercise of exercises) {
    const set = [...exercise.sets]
      .sort((a, b) => a.order - b.order)
      .find(candidate => candidate.status === 'PENDING');

    if (set) {
      return { exercise, set };
    }
  }

  return null;
}
