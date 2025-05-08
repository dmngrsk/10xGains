import { Injectable, inject, signal, computed } from '@angular/core';
import { SupabaseService } from '../db/supabase.service';
import { ExerciseDto } from '../api/api.types';

/**
 * Service to manage exercises from the database
 * Provides methods to load, find, and access exercise data
 */
@Injectable({
  providedIn: 'root'
})
export class ExerciseService {
  private supabaseService = inject(SupabaseService);

  // Store all exercises as signals
  private exercises = signal<ExerciseDto[]>([]);
  private loading = signal<boolean>(false);
  private loaded = signal<boolean>(false);

  constructor() {
    // Load all exercises on initialization
    this.loadAllExercises();
  }

  /**
   * Finds an exercise by ID
   * @param id The exercise ID to find
   * @returns A computed signal with the exercise or undefined if not found
   */
  public find(id: string) {
    const findSignal = computed(() => this.exercises().find(exercise => exercise.id === id));
    return findSignal();
  }

  /**
   * Loads all exercises from the database
   * @returns Promise that resolves when exercises are loaded
   */
  public async loadAllExercises(): Promise<ExerciseDto[]> {
    try {
      if (this.loaded()) {
        return this.exercises();
      }

      this.loading.set(true);

      const { data, error } = await this.supabaseService.client
        .from('exercises')
        .select('*');

      if (error) {
        throw error;
      }

      const exercises = data as ExerciseDto[];
      this.exercises.set(exercises);
      this.loaded.set(true);

      return exercises;
    } catch (error) {
      console.error('Error loading exercises:', error);
      return [];
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Refreshes the exercises data from the database
   */
  public async refresh(): Promise<ExerciseDto[]> {
    this.loaded.set(false);
    return this.loadAllExercises();
  }

  // Public getters for the signals
  public getExercises() {
    return this.exercises;
  }

  public getLoading() {
    return this.loading;
  }

  public getLoaded() {
    return this.loaded;
  }
}
