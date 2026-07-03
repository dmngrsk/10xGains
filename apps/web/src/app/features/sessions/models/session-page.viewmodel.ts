import { SessionStatus, SessionSetStatus } from './session.types';

export interface SessionPageViewModel {
  id: string | null;
  metadata?: SessionMetadataViewModel;
  exercises: SessionExerciseViewModel[];
  isLoading: boolean;
  error: string | null;
}

export interface SessionMetadataViewModel {
  planId?: string;
  dayName?: string;
  planName?: string;
  date?: Date;
  status?: SessionStatus;
}

export interface SessionExerciseViewModel {
  planExerciseId: string;
  exerciseName: string;
  order: number;
  sets: SessionSetViewModel[];
  plannedSetsCount: number;
}

export interface SessionSetViewModel {
  id: string;
  planExerciseId: string;
  order: number;
  status: SessionSetStatus;
  expectedReps: number;
  actualReps?: number | null;
  weight?: number;
}
