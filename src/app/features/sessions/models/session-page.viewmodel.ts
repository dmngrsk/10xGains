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
  date?: Date;
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
