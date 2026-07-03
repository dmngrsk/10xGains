import { PlanDto, PlanDayDto, PlanExerciseDto, PlanExerciseSetDto, ExerciseDto, ProfileDto, PlanExerciseProgressionDto } from '@shared/api/api.types';
import { PlanViewModel, PlanDayViewModel, PlanExerciseViewModel, PlanExerciseSetViewModel, PlanExerciseProgressionViewModel } from './plan.viewmodel';

export function mapToPlanViewModel(
  dto: PlanDto,
  allExercises: ExerciseDto[],
  profile: ProfileDto | null
): PlanViewModel {
  if (!dto) {
    throw new Error('Plan DTO is required');
  }

  const trainingDays: PlanDayViewModel[] = (dto.days || []).map((dayDto: PlanDayDto): PlanDayViewModel => {
    const exercises: PlanExerciseViewModel[] = (dayDto.exercises || []).map((exDto: PlanExerciseDto): PlanExerciseViewModel => {
      const exercise = allExercises.find(e => e.id === exDto.exercise_id);
      const exerciseName = exercise ? exercise.name : 'Unknown Exercise';
      const exerciseDescription = exercise ? exercise.description : null;

      const sets: PlanExerciseSetViewModel[] = (exDto.sets || []).map((setDto: PlanExerciseSetDto): PlanExerciseSetViewModel => ({
        id: setDto.id,
        setIndex: setDto.set_index,
        expectedReps: setDto.expected_reps ?? null,
        expectedWeight: setDto.expected_weight ?? null,
        planExerciseId: setDto.plan_exercise_id
      }));

      return {
        id: exDto.id,
        exerciseId: exDto.exercise_id,
        exerciseName: exerciseName,
        exerciseDescription: exerciseDescription,
        orderIndex: exDto.order_index,
        planDayId: exDto.plan_day_id,
        sets: sets.sort((a, b) => a.setIndex - b.setIndex)
      };
    });

    return {
      id: dayDto.id,
      name: dayDto.name,
      description: dayDto.description,
      orderIndex: dayDto.order_index,
      planId: dayDto.plan_id,
      exercises: exercises.sort((a, b) => a.orderIndex - b.orderIndex)
    };
  });

  const progressions = (dto.progressions || []).map((progressionDto): PlanExerciseProgressionViewModel => {
    const exercise = allExercises.find(e => e.id === progressionDto.exercise_id);
    const exerciseName = exercise ? exercise.name : 'Unknown Exercise';

    return {
      id: progressionDto.id,
      planId: progressionDto.plan_id,
      exerciseId: progressionDto.exercise_id,
      exerciseName: exerciseName,
      weightIncrement: progressionDto.weight_increment ?? null,
      failureCountForDeload: progressionDto.failure_count_for_deload ?? null,
      deloadPercentage: progressionDto.deload_percentage ?? null,
      deloadStrategy: progressionDto.deload_strategy ?? null,
      consecutiveFailures: progressionDto.consecutive_failures ?? null,
      referenceSetIndex: progressionDto.reference_set_index ?? null,
      lastUpdated: progressionDto.last_updated ? new Date(progressionDto.last_updated) : null,
    };
  });

  return {
    id: dto.id,
    userId: dto.user_id,
    name: dto.name,
    description: dto.description,
    createdAt: dto.created_at ? new Date(dto.created_at) : null,
    isActive: profile ? dto.id === profile.active_plan_id : false,
    days: trainingDays.sort((a,b) => a.orderIndex - b.orderIndex),
    progressions,
  };
}

export function mapToPlanDto(viewModel: PlanViewModel): PlanDto {
  if (!viewModel) {
    throw new Error('Plan ViewModel is required');
  }

  return {
    id: viewModel.id,
    user_id: viewModel.userId,
    name: viewModel.name,
    description: viewModel.description,
    created_at: viewModel.createdAt?.toISOString() ?? new Date().toISOString(),
    days: (viewModel.days || [])
      .map(mapToPlanDayDto)
      .sort((a,b) => a.order_index - b.order_index),
    progressions: (viewModel.progressions || []).map(mapToPlanExerciseProgressionDto),
  };
}

export function mapToPlanDayDto(day: PlanDayViewModel): PlanDayDto {
  if (!day) {
    throw new Error('Plan day ViewModel is required');
  }

  return {
    id: day.id,
    name: day.name,
    description: day.description,
    order_index: day.orderIndex,
    plan_id: day.planId,
    exercises: (day.exercises || [])
      .map(mapToPlanExerciseDto)
      .sort((a,b) => a.order_index - b.order_index)
  };
}

export function mapToPlanExerciseDto(exercise: PlanExerciseViewModel): PlanExerciseDto {
  if (!exercise) {
    throw new Error('Plan exercise ViewModel is required');
  }

  return {
    id: exercise.id,
    exercise_id: exercise.exerciseId,
    order_index: exercise.orderIndex,
    plan_day_id: exercise.planDayId,
    sets: (exercise.sets || [])
      .map(mapToPlanExerciseSetDto)
      .sort((a, b) => a.set_index - b.set_index)
  };
}

export function mapToPlanExerciseSetDto(set: PlanExerciseSetViewModel): PlanExerciseSetDto {
  if (!set) {
    throw new Error('Plan exercise set ViewModel is required');
  }

  return {
    id: set.id,
    set_index: set.setIndex,
    expected_reps: set.expectedReps ?? 0,
    expected_weight: set.expectedWeight ?? 0,
    plan_exercise_id: set.planExerciseId,
  };
}

export function mapToPlanExerciseProgressionDto(
  progression: PlanExerciseProgressionViewModel
): PlanExerciseProgressionDto {
  if (!progression) {
    throw new Error('Plan exercise progression ViewModel is required');
  }

  return {
    id: progression.id,
    plan_id: progression.planId,
    exercise_id: progression.exerciseId,
    weight_increment: progression.weightIncrement,
    failure_count_for_deload: progression.failureCountForDeload,
    deload_percentage: progression.deloadPercentage,
    deload_strategy: progression.deloadStrategy,
    consecutive_failures: progression.consecutiveFailures,
    reference_set_index: progression.referenceSetIndex,
    last_updated: progression.lastUpdated?.toISOString() ?? new Date().toISOString(),
  } as PlanExerciseProgressionDto;
}
