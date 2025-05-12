import { Injectable, inject, signal } from '@angular/core';
import { ExerciseDto, CreateExerciseCommand } from '../api/api.types';
import { ApiService, ApiServiceResponse } from '../api/api.service';
import { Observable, tap, firstValueFrom } from 'rxjs';

/**
 * Service to manage exercises from the database
 * Provides methods to load, find, and access exercise data
 */
@Injectable({
  providedIn: 'root'
})
export class ExerciseService {
  private apiService = inject(ApiService);

  private exercises = signal<ExerciseDto[]>([]);
  private loading = signal<boolean>(false);

  constructor() {
    this.loadAllExercises();
  }

  private async loadAllExercises(): Promise<ExerciseDto[]> {
    this.loading.set(true);

    try {
      const response = await firstValueFrom(this.apiService.get<ExerciseDto[]>('exercises'));

      if (response.data) {
        this.exercises.set(response.data);
        return response.data;
      } else {
        console.error('Error loading exercises via ApiService:', response.error);
        this.exercises.set([]);
        throw new Error(response.error || 'Failed to load exercises');
      }
    } catch (error) {
      console.error('Critical error in loadAllExercises:', error);
      this.exercises.set([]);
      return [];
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Finds an exercise by ID
   * @param id The exercise ID to find
   * @returns A computed signal with the exercise or undefined if not found
   */
  public find(id: string): ExerciseDto | undefined {
    return this.exercises().find(exercise => exercise.id === id);
  }

  /**
   * Returns all exercises
   * @returns A computed signal with all exercises
   */
  public getAll(): ExerciseDto[] {
    return this.exercises();
  }

  /**
   * Refreshes the exercises data from the database
   */
  public async refresh(): Promise<ExerciseDto[]> {
    return this.loadAllExercises();
  }

  /**
   * Creates a new global exercise.
   * @param command The command object containing exercise details (name, description).
   * @returns Observable with the created exercise data and potential error.
   */
  createExercise(command: CreateExerciseCommand): Observable<ApiServiceResponse<ExerciseDto>> {
    const url = 'exercises';
    return this.apiService.post<CreateExerciseCommand, ExerciseDto>(url, command).pipe(
      tap(response => {
        if (response.data) {
          this.refresh();
        }
      })
    );
  }
}
