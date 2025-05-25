import { TrainingSessionDto, SessionSetDto, ExerciseDto, TrainingPlanExerciseSetDto, TrainingPlanDto } from '@shared/api/api.types';
import { SessionStatus, SessionSetStatus } from './session.types';

export interface SessionPageViewModel {
  id: string | null;
  metadata?: SessionMetadataViewModel;
  exercises: SessionExerciseViewModel[];
  isLoading: boolean;
  error: string | null;
}

export interface SessionMetadataViewModel {
  trainingPlanId?: string;
  dayName?: string;
  planName?: string;
  date?: string;
  status?: SessionStatus;
}

export interface SessionExerciseViewModel {
  trainingPlanExerciseId: string;
  exerciseName: string;
  order: number;
  sets: SessionSetViewModel[];
  plannedSetsCount: number;
}

export interface SessionSetViewModel {
  id: string;
  trainingPlanExerciseId: string;
  order: number;
  status: SessionSetStatus;
  expectedReps: number;
  actualReps?: number | null;
  weight?: number;
}

export function mapToSessionPageViewModel(
  currentSession: TrainingSessionDto,
  plan: TrainingPlanDto | undefined | null,
  exerciseDetailsMap: Map<string, Pick<ExerciseDto, 'name'>>
): SessionPageViewModel | null {
  if (!plan) {
    console.warn('[mapTrainingDataToSessionViewModels] Plan day data or planned exercises are missing. Cannot map to SessionExerciseViewModel structure.');
    return null;
  }

  const planDay = plan.days?.find(d => d.id == currentSession.training_plan_day_id) ?? null;

  if (!planDay || !planDay.exercises) {
    console.warn('[mapTrainingDataToSessionViewModels] Plan day data or planned exercises are missing. Cannot map to SessionExerciseViewModel structure.');
    return null;
  }

  const sessionExercisesViewModel: SessionExerciseViewModel[] = [];

  const sessionSetsByTpeId = new Map<string, SessionSetDto[]>();
  if (currentSession.sets) {
    for (const set of currentSession.sets) {
      const setsForExercise = sessionSetsByTpeId.get(set.training_plan_exercise_id) || [];
      setsForExercise.push(set);
      sessionSetsByTpeId.set(set.training_plan_exercise_id, setsForExercise);
    }
  }

  for (const plannedExercise of planDay.exercises) {
    if (!plannedExercise.id || !plannedExercise.exercise_id) {
      console.warn('[mapTrainingDataToSessionViewModels] Skipping planned exercise due to missing id or exercise_id:', plannedExercise);
      continue;
    }

    const exerciseName = exerciseDetailsMap.get(plannedExercise.exercise_id)?.name || 'Unknown Exercise';
    const actualSetsForThisExercise: SessionSetDto[] = sessionSetsByTpeId.get(plannedExercise.id) || [];

    const sessionSetViewModels: SessionSetViewModel[] = actualSetsForThisExercise
      .map(actualSet => {
        let correspondingPlannedSet: TrainingPlanExerciseSetDto | undefined;
        if (plannedExercise.sets) {
          correspondingPlannedSet = plannedExercise.sets.find(ps => ps.set_index === actualSet.set_index);
        }

        const viewModelSet: SessionSetViewModel = {
          id: actualSet.id,
          trainingPlanExerciseId: actualSet.training_plan_exercise_id,
          order: actualSet.set_index,
          status: actualSet.status as SessionSetStatus,
          expectedReps: correspondingPlannedSet?.expected_reps ?? actualSet.expected_reps ?? 0,
          actualReps: actualSet.actual_reps,
          weight: actualSet.actual_weight,
        };
        return viewModelSet;
      })
      .sort((a, b) => a.order - b.order);

    sessionExercisesViewModel.push({
      trainingPlanExerciseId: plannedExercise.id,
      exerciseName: exerciseName,
      order: plannedExercise.order_index ?? 0,
      sets: sessionSetViewModels,
      plannedSetsCount: plannedExercise.sets?.length ?? 0,
    });
  }

  sessionExercisesViewModel.sort((a, b) => a.order - b.order);

  return {
    id: currentSession.id,
    metadata: {
      trainingPlanId: currentSession.training_plan_id ?? undefined,
      dayName: planDay.name,
      planName: plan.name,
      date: currentSession.session_date ?? undefined,
      status: currentSession.status as SessionStatus
    },
    exercises: sessionExercisesViewModel,
    isLoading: false,
    error: null,
  }
}

export function mapToSessionSetViewModel(setDto: SessionSetDto, originalExpectedReps?: number | null): SessionSetViewModel {
  return {
    id: setDto.id,
    status: setDto.status as SessionSetStatus,
    order: setDto.set_index,
    expectedReps: originalExpectedReps ?? setDto.expected_reps ?? 0,
    actualReps: setDto.actual_reps,
    weight: setDto.actual_weight,
    trainingPlanExerciseId: setDto.training_plan_exercise_id,
  };
}
