import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService, ApiServiceResponse } from './api.service';
import { ExerciseDto, CreateExerciseCommand } from './api.types';

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
   * @returns An Observable emitting a `ExerciseServiceResponse` containing an array of `ExerciseDto`.
   */
  public getExercises(): Observable<ExerciseServiceResponse<ExerciseDto[]>> {
    const url = '/exercises';
    return this.apiService.get<ExerciseDto[]>(url);
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
