import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '../../../shared/db/supabase.service';
import { Observable, from, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { PostgrestError } from '@supabase/supabase-js';
import { TrainingPlanDto } from '../../../shared/api/api.types';

export interface PlanServiceResponse {
  data: TrainingPlanDto[] | null;
  error: PostgrestError | null;
}

@Injectable({
  providedIn: 'root'
})
export class PlanService {
  private readonly supabaseService = inject(SupabaseService);

  /**
   * Get plans for a specific user with pagination
   * @param userId The user ID to fetch plans for
   * @param limit Maximum number of plans to fetch
   * @param offset Starting position for pagination
   * @returns Observable with plans data and potential error
   */
  getPlans(userId: string, limit: number, offset: number): Observable<PlanServiceResponse> {
    if (!userId) {
      return throwError(() => new Error('User ID is required'));
    }

    if (limit <= 0) {
      return throwError(() => new Error('Limit must be greater than 0'));
    }

    if (offset < 0) {
      return throwError(() => new Error('Offset must be greater than or equal to 0'));
    }

    const promise = this.supabaseService.client
      .from('training_plans')
      .select(`
        *,
        training_days:training_plan_days (
          *,
          exercises:training_plan_exercises (
            *
          )
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)
      .range(offset, offset + limit - 1)
      .then(({ data, error }) => ({
        data: data as TrainingPlanDto[] | null,
        error
      }));

    return from(promise).pipe(
      catchError(error => throwError(() => new Error(`Failed to fetch plans: ${error.message}`)))
    );
  }
}
