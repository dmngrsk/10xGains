import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ExerciseProgressDto } from '@txg/shared';
import { ApiService, ApiServiceResponse } from '@shared/api/api.service';

export interface GetExerciseProgressParams {
  plan_id?: string;
  exercise_ids?: string[];
  date_from?: string;
  date_to?: string;
}

export type ProgressServiceResponse<T> = ApiServiceResponse<T>;

@Injectable({
  providedIn: 'root',
})
export class ProgressService {
  private apiService = inject(ApiService);

  /**
   * Retrieves aggregated per-exercise progress series.
   * @param params Query parameters narrowing the series by plan, exercises and date range.
   * @returns An Observable emitting the aggregated progress series.
   */
  getExerciseProgress(params: GetExerciseProgressParams): Observable<ProgressServiceResponse<ExerciseProgressDto[]>> {
    const queryParams = new URLSearchParams();
    let url = '/progress/exercises';

    if (params.plan_id) {
      queryParams.append('plan_id', params.plan_id);
    }
    if (params.exercise_ids !== undefined && params.exercise_ids.length > 0) {
      queryParams.append('exercise_ids', params.exercise_ids.join(','));
    }
    if (params.date_from !== undefined) {
      queryParams.append('date_from', params.date_from);
    }
    if (params.date_to !== undefined) {
      queryParams.append('date_to', params.date_to);
    }

    const queryString = queryParams.toString();
    if (queryString) {
      url += `?${queryString}`;
    }

    return this.apiService.get<ExerciseProgressDto[]>(url);
  }
}
