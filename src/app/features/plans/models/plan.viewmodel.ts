export interface PlanViewModel {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  createdAt: Date | null;
  isActive: boolean;
  days: PlanDayViewModel[];
  progressions: PlanExerciseProgressionViewModel[];
}

export interface PlanDayViewModel {
  id: string;
  name: string;
  description: string | null;
  orderIndex: number;
  planId: string;
  exercises: PlanExerciseViewModel[];
}

export interface PlanExerciseViewModel {
  id: string;
  exerciseId: string;
  exerciseName: string;
  exerciseDescription: string | null;
  orderIndex: number;
  planDayId: string;
  sets: PlanExerciseSetViewModel[];
}

export interface PlanExerciseSetViewModel {
  id: string;
  setIndex: number;
  expectedReps: number | null;
  expectedWeight: number | null;
  planExerciseId: string;
}

export interface PlanExerciseProgressionViewModel {
  id: string;
  planId: string;
  exerciseId: string;
  exerciseName: string;
  weightIncrement: number | null;
  failureCountForDeload: number | null;
  deloadPercentage: number | null;
  deloadStrategy: string | null;
  consecutiveFailures: number | null;
  referenceSetIndex: number | null;
  lastUpdated: Date | null;
}
