import { SessionStatus, SessionSetStatus } from "./session.enum";

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
