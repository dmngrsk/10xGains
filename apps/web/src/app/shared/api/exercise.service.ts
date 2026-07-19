import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ExerciseDto, CreateExerciseCommand } from '@txg/shared';
import { ApiService, ApiServiceResponse } from './api.service';

export type ExerciseServiceResponse<T> = ApiServiceResponse<T>;

/**
 * Service responsible for handling global exercise related API operations.
 */
@Injectable({
  providedIn: 'root'
})
export class ExerciseService {
  private apiService = inject(ApiService);

  /**
   * Retrieves all exercises from the database.
   *
   * Pages through the endpoint rather than issuing a single request: `/exercises` is capped at 20
   * rows by default, and every feature builds its exercise-name lookup from this call, so a
   * truncated result renders later entries as 'Unknown Exercise' and hides them from the plan
   * editor's add-exercise list.
   *
   * @returns An Observable emitting a `ExerciseServiceResponse` containing an array of `ExerciseDto`.
   */
  public getExercises(): Observable<ExerciseServiceResponse<ExerciseDto[]>> {
    const url = '/exercises';
    return this.apiService.getAll<ExerciseDto>(url);
  }

  /**
   * Creates a new global exercise.
   * @param command The command object containing exercise details (name, description).
   * @returns Observable with the created exercise data and potential error.
   */
  createExercise(command: CreateExerciseCommand): Observable<ExerciseServiceResponse<ExerciseDto>> {
    const url = '/exercises';
    return this.apiService.post<CreateExerciseCommand, ExerciseDto>(url, command);
  }
}
