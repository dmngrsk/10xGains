import { TrainingPlanDto, TrainingPlanDayDto, TrainingPlanExerciseDto, TrainingPlanExerciseSetDto, ExerciseDto, UserProfileDto } from '@shared/api/api.types';
import { TrainingPlanViewModel, TrainingPlanDayViewModel, TrainingPlanExerciseViewModel, TrainingPlanExerciseSetViewModel } from './training-plan.viewmodel';

export function mapToTrainingPlanViewModel(
  dto: TrainingPlanDto,
  allExercises: ExerciseDto[],
  userProfile: UserProfileDto | null
): TrainingPlanViewModel {
  if (!dto) {
    throw new Error('Training plan DTO is required');
  }

  const trainingDays: TrainingPlanDayViewModel[] = (dto.days || []).map((dayDto: TrainingPlanDayDto): TrainingPlanDayViewModel => {
    const exercises: TrainingPlanExerciseViewModel[] = (dayDto.exercises || []).map((exDto: TrainingPlanExerciseDto): TrainingPlanExerciseViewModel => {
      const exercise = allExercises.find(e => e.id === exDto.exercise_id);
      const exerciseName = exercise ? exercise.name : 'Unknown Exercise';

      const sets: TrainingPlanExerciseSetViewModel[] = (exDto.sets || []).map((setDto: TrainingPlanExerciseSetDto): TrainingPlanExerciseSetViewModel => ({
        id: setDto.id,
        setIndex: setDto.set_index,
        expectedReps: setDto.expected_reps ?? null,
        expectedWeight: setDto.expected_weight ?? null,
        trainingPlanExerciseId: setDto.training_plan_exercise_id
      }));

      return {
        id: exDto.id,
        exerciseId: exDto.exercise_id,
        exerciseName: exerciseName,
        orderIndex: exDto.order_index,
        trainingPlanDayId: exDto.training_plan_day_id,
        sets: sets.sort((a, b) => a.setIndex - b.setIndex)
      };
    });

    return {
      id: dayDto.id,
      name: dayDto.name,
      description: dayDto.description,
      orderIndex: dayDto.order_index,
      trainingPlanId: dayDto.training_plan_id,
      exercises: exercises.sort((a, b) => a.orderIndex - b.orderIndex)
    };
  });

  return {
    id: dto.id,
    userId: dto.user_id,
    name: dto.name,
    description: dto.description,
    createdAt: dto.created_at ?? null,
    isActive: userProfile ? dto.id === userProfile.active_training_plan_id : false,
    days: trainingDays.sort((a,b) => a.orderIndex - b.orderIndex),
  };
}

export function mapToTrainingPlanDto(viewModel: TrainingPlanViewModel): TrainingPlanDto {
  if (!viewModel) {
    throw new Error('Training plan ViewModel is required');
  }

  return {
    id: viewModel.id,
    user_id: viewModel.userId,
    name: viewModel.name,
    description: viewModel.description,
    created_at: viewModel.createdAt ?? new Date().toISOString(),
    days: (viewModel.days || [])
      .map(mapToTrainingPlanDayDto)
      .sort((a,b) => a.order_index - b.order_index)
  };
}

export function mapToTrainingPlanDayDto(day: TrainingPlanDayViewModel): TrainingPlanDayDto {
  if (!day) {
    throw new Error('Training plan day ViewModel is required');
  }

  return {
    id: day.id,
    name: day.name,
    description: day.description,
    order_index: day.orderIndex,
    training_plan_id: day.trainingPlanId,
    exercises: (day.exercises || [])
      .map(mapToTrainingPlanExerciseDto)
      .sort((a,b) => a.order_index - b.order_index)
  };
}

export function mapToTrainingPlanExerciseDto(exercise: TrainingPlanExerciseViewModel): TrainingPlanExerciseDto {
  if (!exercise) {
    throw new Error('Training plan exercise ViewModel is required');
  }

  return {
    id: exercise.id,
    exercise_id: exercise.exerciseId,
    order_index: exercise.orderIndex,
    training_plan_day_id: exercise.trainingPlanDayId,
    sets: (exercise.sets || [])
      .map(mapToTrainingPlanExerciseSetDto)
      .sort((a, b) => a.set_index - b.set_index)
  };
}

export function mapToTrainingPlanExerciseSetDto(set: TrainingPlanExerciseSetViewModel): TrainingPlanExerciseSetDto {
  if (!set) {
    throw new Error('Training plan exercise set ViewModel is required');
  }

  return {
    id: set.id,
    set_index: set.setIndex,
    expected_reps: set.expectedReps ?? 0,
    expected_weight: set.expectedWeight ?? 0,
    training_plan_exercise_id: set.trainingPlanExerciseId,
  };
}
