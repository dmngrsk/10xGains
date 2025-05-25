import { ExerciseDto, TrainingPlanDto, TrainingSessionDto } from "@shared/api/api.types";
import { SessionStatus, SessionSetStatus } from "./session.types";

export interface SessionCardViewModel {
  id: string;
  title: string;
  sessionDate: Date | null;
  status: SessionStatus;
  exercises: SessionCardExerciseViewModel[];
}

export interface SessionCardExerciseViewModel {
  name: string;
  sets: SessionCardSetViewModel[];
}

export interface SessionCardSetViewModel {
  expectedReps: number | null;
  actualReps: number | null;
  actualWeight: number | null;
  status: SessionSetStatus;
  completedAt: Date | null;
}

export function mapToSesssionCardViewModel(
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
    sessionDate: session.session_date ? new Date(ensureUtc(session.session_date)) : null,
    status: session.status as SessionStatus,
    exercises: sessionExercises,
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
