import { Injectable, inject } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { ApiService, ApiServiceResponse } from '@shared/api/api.service';
import {
  TrainingPlanDto,
  UpdateTrainingPlanCommand,
  CreateTrainingPlanDayCommand,
  TrainingPlanDayDto,
  UpdateTrainingPlanDayCommand,
  CreateTrainingPlanExerciseCommand,
  TrainingPlanExerciseDto,
  CreateTrainingPlanExerciseSetCommand,
  TrainingPlanExerciseSetDto,
  UpdateTrainingPlanExerciseSetCommand,
  UpdateTrainingPlanExerciseCommand,
  CreateTrainingPlanCommand,
  TrainingPlanExerciseProgressionDto,
  UpdateTrainingPlanExerciseProgressionCommand
} from '@shared/api/api.types';

export type PlanServiceResponse<T> = ApiServiceResponse<T>;

@Injectable({
  providedIn: 'root'
})
export class PlanService {
  private readonly apiService = inject(ApiService);

  /**
   * Get plans for the authenticated user with pagination.
   * @param limit Maximum number of plans to fetch
   * @param offset Starting position for pagination
   * @returns Observable with plans data and potential error
   */
  getPlans(limit: number, offset: number): Observable<PlanServiceResponse<TrainingPlanDto[]>> {
    if (limit <= 0) {
      return throwError(() => new Error('Limit must be greater than 0'));
    }
    if (offset < 0) {
      return throwError(() => new Error('Offset must be greater than or equal to 0'));
    }
    const url = `training-plans?limit=${limit}&offset=${offset}`;
    return this.apiService.get<TrainingPlanDto[]>(url);
  }

  /**
   * Get a single training plan by ID.
   * @param planId The ID of the plan to fetch
   * @returns Observable with the plan data and potential error
   */
  getPlan(planId: string): Observable<PlanServiceResponse<TrainingPlanDto>> {
    if (!planId) {
      return throwError(() => new Error('Plan ID is required'));
    }
    const url = `training-plans/${planId}`;
    return this.apiService.get<TrainingPlanDto>(url);
  }

  /**
   * Updates a training plan.
   * @param planId The ID of the plan to update.
   * @param payload The data to update (name, description).
   * @returns Observable with the updated plan data and potential error.
   */
  updatePlan(planId: string, payload: UpdateTrainingPlanCommand): Observable<PlanServiceResponse<TrainingPlanDto>> {
    if (!planId) {
      return throwError(() => new Error('Plan ID is required for update'));
    }
    if (!payload || (payload.name === undefined && payload.description === undefined)) {
      return throwError(() => new Error('Payload with name or description is required for update'));
    }
    const url = `training-plans/${planId}`;
    return this.apiService.put<UpdateTrainingPlanCommand, TrainingPlanDto>(url, payload);
  }

  /**
   * Creates a new training plan.
   * @param payload The command object containing plan details (name, description).
   * @returns Observable with the created plan data and potential error.
   */
  createPlan(payload: CreateTrainingPlanCommand): Observable<PlanServiceResponse<TrainingPlanDto>> {
    if (!payload || !payload.name || payload.name.trim() === '') {
      return throwError(() => new Error('Plan name in payload is required for creation'));
    }
    const url = 'training-plans';
    return this.apiService.post<CreateTrainingPlanCommand, TrainingPlanDto>(url, payload);
  }

  /**
   * Creates a new training day for a given plan.
   * @param planId The ID of the plan to add the day to.
   * @param command The command object containing day details (name, description, order_index).
   * @returns Observable with the created day data and potential error.
   */
  createTrainingDay(planId: string, command: CreateTrainingPlanDayCommand): Observable<PlanServiceResponse<TrainingPlanDayDto>> {
    if (!planId) {
      return throwError(() => new Error('Plan ID is required to create a day'));
    }
    if (!command || !command.name || command.name.trim() === '') {
      return throwError(() => new Error('Day name in command is required'));
    }

    const url = `training-plans/${planId}/days`;
    return this.apiService.post<CreateTrainingPlanDayCommand, TrainingPlanDayDto>(url, command);
  }

  /**
   * Updates a specific training day within a plan.
   * @param planId The ID of the plan.
   * @param dayId The ID of the day to update.
   * @param payload The data to update (name, description, order_index).
   * @returns Observable with the updated day data and potential error.
   */
  updatePlanDay(planId: string, dayId: string, payload: UpdateTrainingPlanDayCommand): Observable<PlanServiceResponse<TrainingPlanDayDto>> {
    if (!planId || !dayId) {
      return throwError(() => new Error('Plan ID and Day ID are required for update'));
    }
    if (!payload) {
      return throwError(() => new Error('Payload is required for update'));
    }

    const url = `training-plans/${planId}/days/${dayId}`;
    return this.apiService.put<UpdateTrainingPlanDayCommand, TrainingPlanDayDto>(url, payload);
  }

  /**
   * Deletes a specific training day from a plan.
   * @param planId The ID of the plan.
   * @param dayId The ID of the day to delete.
   * @returns Observable indicating success (null data) or error.
   */
  deletePlanDay(planId: string, dayId: string): Observable<PlanServiceResponse<null>> {
    if (!planId || !dayId) {
      return throwError(() => new Error('Plan ID and Day ID are required for delete'));
    }
    const url = `training-plans/${planId}/days/${dayId}`;
    return this.apiService.delete(url);
  }

  /**
   * Adds an exercise to a specific training day within a plan.
   * @param planId The ID of the training plan.
   * @param dayId The ID of the day to add the exercise to.
   * @param command The command object containing exercise details (exercise_id, order_index).
   * @returns Observable with the created training plan exercise data and potential error.
   */
  addExerciseToPlanDay(planId: string, dayId: string, command: CreateTrainingPlanExerciseCommand): Observable<PlanServiceResponse<TrainingPlanExerciseDto>> {
    if (!planId || !dayId) {
      return throwError(() => new Error('Plan ID and Day ID are required'));
    }
    if (!command || !command.exercise_id) {
      return throwError(() => new Error('Exercise ID in command is required'));
    }
    if (command.order_index !== undefined && command.order_index < 0) {
      return throwError(() => new Error('Order index must be non-negative if provided'));
    }

    const url = `training-plans/${planId}/days/${dayId}/exercises`;
    return this.apiService.post<CreateTrainingPlanExerciseCommand, TrainingPlanExerciseDto>(url, command);
  }

  /**
   * Adds a set to a specific training plan exercise.
   * @param planId The ID of the training plan.
   * @param dayId The ID of the training plan day.
   * @param planExerciseId The ID of the training plan exercise to add the set to.
   * @param command The command object for creating the set.
   * @returns Observable with the created set data and potential error.
   */
  addSetToPlanExercise(planId: string, dayId: string, planExerciseId: string, command: CreateTrainingPlanExerciseSetCommand): Observable<PlanServiceResponse<TrainingPlanExerciseSetDto>> {
    if (!planId || !dayId || !planExerciseId) {
      return throwError(() => new Error('Plan ID, Day ID, and Training Plan Exercise ID are required'));
    }
    if (!command || command.expected_reps === undefined || command.expected_weight === undefined) {
      return throwError(() => new Error('Command with expected_reps and expected_weight is required'));
    }
    if (command.set_index !== undefined && command.set_index < 0) {
      return throwError(() => new Error('Set index must be non-negative if provided'));
    }

    const url = `training-plans/${planId}/days/${dayId}/exercises/${planExerciseId}/sets`;
    return this.apiService.post<CreateTrainingPlanExerciseSetCommand, TrainingPlanExerciseSetDto>(url, command);
  }

  /**
   * Deletes a specific set from a training plan exercise.
   * @param planId The ID of the training plan.
   * @param dayId The ID of the training plan day.
   * @param planExerciseId The ID of the training plan exercise.
   * @param setId The ID of the set to delete.
   * @returns Observable indicating success (null data) or error.
   */
  deleteSetFromPlanExercise(planId: string, dayId: string, planExerciseId: string, setId: string): Observable<PlanServiceResponse<null>> {
    if (!planId || !dayId || !planExerciseId || !setId) {
      return throwError(() => new Error('Plan ID, Day ID, Plan Exercise ID, and Set ID are required for delete'));
    }
    const url = `training-plans/${planId}/days/${dayId}/exercises/${planExerciseId}/sets/${setId}`;
    return this.apiService.delete(url);
  }

  /**
   * Updates a specific set within a training plan exercise.
   * @param planId The ID of the training plan.
   * @param dayId The ID of the training plan day.
   * @param planExerciseId The ID of the training plan exercise.
   * @param setId The ID of the set to update.
   * @param payload The data to update (set_index, expected_reps, expected_weight).
   * @returns Observable with the updated set data and potential error.
   */
  updatePlanExerciseSet(
    planId: string,
    dayId: string,
    planExerciseId: string,
    setId: string,
    payload: UpdateTrainingPlanExerciseSetCommand
  ): Observable<PlanServiceResponse<TrainingPlanExerciseSetDto>> {
    if (!planId || !dayId || !planExerciseId || !setId) {
      return throwError(() => new Error('Plan ID, Day ID, Plan Exercise ID, and Set ID are required for update'));
    }
    if (!payload || (payload.expected_reps === undefined && payload.expected_weight === undefined && payload.set_index === undefined)) {
      return throwError(() => new Error('Payload with set_index, expected_reps, or expected_weight is required for update'));
    }
    if (payload.expected_reps !== undefined && payload.expected_reps <= 0) {
      return throwError(() => new Error('Expected reps must be positive if provided'));
    }
    if (payload.expected_weight !== undefined && payload.expected_weight <= 0) {
      return throwError(() => new Error('Expected weight must be positive if provided'));
    }
    if (payload.set_index !== undefined && payload.set_index < 0) {
      return throwError(() => new Error('Set index must be non-negative if provided'));
    }

    const url = `training-plans/${planId}/days/${dayId}/exercises/${planExerciseId}/sets/${setId}`;
    return this.apiService.put<UpdateTrainingPlanExerciseSetCommand, TrainingPlanExerciseSetDto>(url, payload);
  }

  /**
   * Deletes a specific exercise from a training day.
   * @param planId The ID of the training plan.
   * @param dayId The ID of the training plan day.
   * @param trainingPlanExerciseId The ID of the training plan exercise to delete.
   * @returns Observable indicating success (null data) or error.
   */
  deletePlanExercise(planId: string, dayId: string, trainingPlanExerciseId: string): Observable<PlanServiceResponse<null>> {
    if (!planId || !dayId || !trainingPlanExerciseId) {
      return throwError(() => new Error('Plan ID, Day ID, and Training Plan Exercise ID are required for delete'));
    }
    const url = `training-plans/${planId}/days/${dayId}/exercises/${trainingPlanExerciseId}`;
    return this.apiService.delete(url);
  }

  /**
   * Updates a specific training plan exercise, e.g., its order_index.
   * @param planId The ID of the training plan.
   * @param dayId The ID of the training plan day.
   * @param trainingPlanExerciseId The ID of the training plan exercise to update.
   * @param payload The command object, typically containing the new order_index.
   * @returns Observable with the updated training plan exercise data and potential error.
   */
  updatePlanExercise(planId: string, dayId: string, trainingPlanExerciseId: string, payload: UpdateTrainingPlanExerciseCommand): Observable<PlanServiceResponse<TrainingPlanExerciseDto>> {
    if (!planId || !dayId || !trainingPlanExerciseId) {
      return throwError(() => new Error('Plan ID, Day ID, and Training Plan Exercise ID are required for update'));
    }
    if (!payload || payload.order_index === undefined || payload.order_index < 0) {
      return throwError(() => new Error('Payload with a non-negative order_index is required'));
    }

    const url = `training-plans/${planId}/days/${dayId}/exercises/${trainingPlanExerciseId}`;
    return this.apiService.put<UpdateTrainingPlanExerciseCommand, TrainingPlanExerciseDto>(url, payload);
  }

  /**
   * Deletes a training plan.
   * @param planId The ID of the plan to delete.
   * @returns Observable indicating success (null data) or error.
   */
  deletePlan(planId: string): Observable<PlanServiceResponse<null>> {
    if (!planId) {
      return throwError(() => new Error('Plan ID is required for deletion'));
    }
    const url = `training-plans/${planId}`;
    return this.apiService.delete(url);
  }

  /**
   * Retrieves the progression rules for a specific exercise in a training plan.
   * @param planId The ID of the training plan.
   * @param exerciseId The global ID of the exercise (from 'exercises' table).
   * @returns Observable with the exercise progression data or undefined, and potential error.
   */
  getExerciseProgression(planId: string, exerciseId: string): Observable<PlanServiceResponse<TrainingPlanExerciseProgressionDto | undefined>> {
    if (!planId || !exerciseId) {
      return throwError(() => new Error('Plan ID and Exercise ID are required to get progression'));
    }
    const url = `training-plans/${planId}/exercises/${exerciseId}/progression`;
    return this.apiService.get<TrainingPlanExerciseProgressionDto | undefined>(url);
  }

  /**
   * Updates the progression details for a specific exercise in a training plan.
   * @param planId The ID of the training plan.
   * @param exerciseId The global ID of the exercise (from 'exercises' table).
   * @param command The command object containing progression details to update.
   * @returns Observable with the updated exercise progression data and potential error.
   */
  updateExerciseProgression(
    planId: string,
    exerciseId: string,
    command: UpdateTrainingPlanExerciseProgressionCommand
  ): Observable<PlanServiceResponse<TrainingPlanExerciseProgressionDto>> {
    if (!planId || !exerciseId) {
      return throwError(() => new Error('Plan ID and Exercise ID are required to update progression'));
    }
    if (!command) {
      return throwError(() => new Error('Command payload is required for updating progression'));
    }

    const url = `training-plans/${planId}/exercises/${exerciseId}/progression`;
    return this.apiService.put<UpdateTrainingPlanExerciseProgressionCommand, TrainingPlanExerciseProgressionDto>(url, command);
  }
}
