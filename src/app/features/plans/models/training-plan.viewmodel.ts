export interface TrainingPlanViewModel {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  createdAt: Date | null;
  isActive: boolean;
  days: TrainingPlanDayViewModel[];
  progressions: TrainingPlanExerciseProgressionViewModel[];
}

export interface TrainingPlanDayViewModel {
  id: string;
  name: string;
  description: string | null;
  orderIndex: number;
  trainingPlanId: string;
  exercises: TrainingPlanExerciseViewModel[];
}

export interface TrainingPlanExerciseViewModel {
  id: string;
  exerciseId: string;
  exerciseName: string;
  exerciseDescription: string | null;
  orderIndex: number;
  trainingPlanDayId: string;
  sets: TrainingPlanExerciseSetViewModel[];
}

export interface TrainingPlanExerciseSetViewModel {
  id: string;
  setIndex: number;
  expectedReps: number | null;
  expectedWeight: number | null;
  trainingPlanExerciseId: string;
}

export interface TrainingPlanExerciseProgressionViewModel {
  id: string;
  trainingPlanId: string;
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
