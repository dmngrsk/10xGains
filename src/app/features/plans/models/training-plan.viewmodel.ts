export interface TrainingPlanViewModel {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  createdAt: string | null;
  isActive: boolean;
  days: TrainingPlanDayViewModel[];
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
