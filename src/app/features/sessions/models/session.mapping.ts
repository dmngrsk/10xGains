import { ExerciseDto, TrainingPlanDto, TrainingPlanExerciseSetDto, TrainingSessionDto, SessionSetDto } from "@shared/api/api.types";
import { SessionCardViewModel, SessionCardExerciseViewModel, SessionCardSetViewModel } from "./session-card.viewmodel";
import { SessionPageViewModel, SessionExerciseViewModel, SessionSetViewModel } from "./session-page.viewmodel";
import { SessionStatus, SessionSetStatus } from "./session.types";

export function mapToSessionCardViewModel(
  session: TrainingSessionDto,
  plan: TrainingPlanDto,
  allExercises: ExerciseDto[],
): SessionCardViewModel {
  const planDay = plan.days?.find(d => d.id === session.training_plan_day_id);

  const sessionExercises: SessionCardExerciseViewModel[] = [];
  if (planDay?.exercises && allExercises) {
    for (const planExercise of planDay.exercises) {
      const exerciseDetail = allExercises.find(e => e.id === planExercise.exercise_id);
      if (exerciseDetail) {
        const relevantSetsDto = session.sets?.filter(s => s.training_plan_exercise_id === planExercise.id) || [];
        const setsViewModel: SessionCardSetViewModel[] = relevantSetsDto.map(dto => ({
          expectedReps: dto.expected_reps,
          actualReps: dto.actual_reps,
          actualWeight: dto.actual_weight,
          status: dto.status as SessionSetStatus,
          completedAt: dto.completed_at ? new Date(ensureUtc(dto.completed_at)) : null,
        }));
        sessionExercises.push({
          name: exerciseDetail.name,
          sets: setsViewModel,
        });
      }
    }
  }

  return {
    id: session.id,
    title: planDay?.name || 'N/A',
    sessionDate: new Date(ensureUtc(session.session_date)),
    status: session.status as SessionStatus,
    exercises: sessionExercises,
  };
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

function ensureUtc(dateString: string | null | undefined): string {
  if (!dateString) {
    return new Date().toISOString();
  }
  if (dateString.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(dateString)) {
    return dateString;
  }
  return dateString + 'Z';
}
