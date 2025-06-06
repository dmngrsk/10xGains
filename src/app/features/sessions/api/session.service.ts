import { Injectable, inject } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { ApiService, ApiServiceResponse } from '@shared/api/api.service';
import { CompleteSessionSetCommand,
  CreateSessionSetCommand,
  CreateTrainingSessionCommand,
  FailSessionSetCommand,
  ResetSessionSetCommand,
  SessionSetDto,
  TrainingSessionDto,
  UpdateSessionSetCommand
} from '@shared/api/api.types';

export interface GetSessionsParams {
  limit?: number;
  offset?: number;
  order?: string;
  status?: string[];
  date_from?: string;
  date_to?: string;
  plan_id?: string;
}

export type SessionServiceResponse<T> = ApiServiceResponse<T>;

@Injectable({
  providedIn: 'root'
})
export class SessionService {
  private apiService = inject(ApiService);

  /**
   * Retrieves a list of training sessions based on query parameters.
   * @param params Query parameters for filtering and ordering sessions.
   * @returns An Observable emitting an array of training session data.
   */
  getSessions(params: GetSessionsParams): Observable<SessionServiceResponse<TrainingSessionDto[]>> {
    const queryParams = new URLSearchParams();
    let url = '/training-sessions';

    if (params.limit !== undefined) {
      queryParams.append('limit', params.limit.toString());
    }
    if (params.offset !== undefined) {
      queryParams.append('offset', params.offset.toString());
    }
    if (params.order !== undefined) {
      queryParams.append('order', params.order);
    }
    if (params.status !== undefined) {
      queryParams.append('status', params.status.join(','));
    }
    if (params.date_from !== undefined) {
      queryParams.append('date_from', params.date_from);
    }
    if (params.date_to !== undefined) {
      queryParams.append('date_to', params.date_to);
    }
    if (params.plan_id !== undefined) {
      queryParams.append('plan_id', params.plan_id);
    }

    const queryString = queryParams.toString();
    if (queryString) {
      url += `?${queryString}`;
    }

    return this.apiService.get<TrainingSessionDto[]>(url);
  }

  /**
   * Retrieves the details of a specific training session.
   * @param sessionId The ID of the training session to retrieve.
   * @returns An Observable emitting the training session data.
   */
  getSession(sessionId: string): Observable<SessionServiceResponse<TrainingSessionDto>> {
    if (!sessionId) {
      return throwError(() => new Error('Session ID is required.'));
    }

    const url = `/training-sessions/${sessionId}`;
    return this.apiService.get<TrainingSessionDto>(url);
  }

  /**
   * Creates a new training session from a training plan.
   * Does not specify a day, allowing the backend to pick the next available day.
   * @param trainingPlanId The ID of the training plan.
   * @returns An Observable emitting the created training session data.
   */
  createSession(trainingPlanId: string): Observable<SessionServiceResponse<TrainingSessionDto>> {
    if (!trainingPlanId) {
      return throwError(() => new Error('Training Plan ID is required to create a session from a plan.'));
    }

    const url = `/training-sessions`;
    return this.apiService.post<CreateTrainingSessionCommand, TrainingSessionDto>(url, { training_plan_id: trainingPlanId });
  }

  /**
   * Marks a training session as complete.
   * @param sessionId The ID of the training session to complete.
   * @returns An Observable emitting the updated training session data.
   */
  completeSession(sessionId: string): Observable<SessionServiceResponse<TrainingSessionDto>> {
    if (!sessionId) {
      return throwError(() => new Error('Session ID is required to complete the session.'));
    }

    const url = `/training-sessions/${sessionId}/complete`;
    return this.apiService.post<Record<string, never>, TrainingSessionDto>(url, {});
  }

  /**
   * Adds a new set to a training session.
   * @param command The command object containing the details for the new set.
   * @returns An Observable emitting the created session set data.
   */
  createSet(command: CreateSessionSetCommand): Observable<SessionServiceResponse<SessionSetDto>> {
    if (!command.training_session_id) {
      return throwError(() => new Error('training_session_id is required in CreateSessionSetCommand for addSet operation.'));
    }
    if (!command.training_plan_exercise_id) {
      return throwError(() => new Error('training_plan_exercise_id is required in CreateSessionSetCommand for addSet operation.'));
    }

    const url = `/training-sessions/${command.training_session_id}/sets`;
    return this.apiService.post<CreateSessionSetCommand, SessionSetDto>(url, command);
  }

  /**
   * Updates the details of a specific set within a training session.
   * @param sessionId The ID of the training session.
   * @param setId The ID of the set to update.
   * @param command The command object containing the partial updates for the set.
   * @returns An Observable emitting the updated session set data.
   */
  updateSet(sessionId: string, setId: string, command: Partial<UpdateSessionSetCommand>): Observable<SessionServiceResponse<SessionSetDto>> {
    if (!sessionId) {
      return throwError(() => new Error('Session ID is required.'));
    }
    if (!setId) {
      return throwError(() => new Error('Set ID is required.'));
    }
    if (!command || Object.keys(command).length === 0) {
      return throwError(() => new Error('Update command cannot be empty.'));
    }

    const url = `/training-sessions/${sessionId}/sets/${setId}`;
    return this.apiService.put<Partial<UpdateSessionSetCommand>, SessionSetDto>(url, command);
  }

  /**
   * Deletes a specific set from a training session.
   * @param sessionId The ID of the training session.
   * @param setId The ID of the set to delete.
   * @returns An Observable emitting null upon successful deletion.
   */
  deleteSet(sessionId: string, setId: string): Observable<SessionServiceResponse<null>> {
    if (!sessionId) {
      return throwError(() => new Error('Session ID is required.'));
    }
    if (!setId) {
      return throwError(() => new Error('Set ID is required.'));
    }

    const url = `/training-sessions/${sessionId}/sets/${setId}`;
    return this.apiService.delete(url);
  }

  /**
   * Marks a specific set within a training session as complete.
   * @param sessionId The ID of the training session.
   * @param setId The ID of the set to complete.
   * @returns An Observable emitting the updated session set data.
   */
  completeSet(sessionId: string, setId: string): Observable<SessionServiceResponse<SessionSetDto>> {
    if (!sessionId) {
      return throwError(() => new Error('Session ID is required.'));
    }
    if (!setId) {
      return throwError(() => new Error('Set ID is required.'));
    }

    const url = `/training-sessions/${sessionId}/sets/${setId}/complete`;
    return this.apiService.patch<CompleteSessionSetCommand, SessionSetDto>(url, {});
  }

  /**
   * Marks a specific set within a training session as failed.
   * @param sessionId The ID of the training session.
   * @param setId The ID of the set to mark as failed.
   * @param actualReps The actual number of repetitions performed.
   * @returns An Observable emitting the updated session set data.
   */
  failSet(sessionId: string, setId: string, actualReps: number): Observable<SessionServiceResponse<SessionSetDto>> {
    if (!sessionId) {
      return throwError(() => new Error('Session ID is required.'));
    }
    if (!setId) {
      return throwError(() => new Error('Set ID is required.'));
    }
    if (actualReps < 0) {
      return throwError(() => new Error('Actual reps cannot be negative.'));
    }

    const url = `/training-sessions/${sessionId}/sets/${setId}/fail?reps=${actualReps}`;
    return this.apiService.patch<FailSessionSetCommand, SessionSetDto>(url, {});
  }

  /**
   * Resets a specific set within a training session to its initial state.
   * @param sessionId The ID of the training session.
   * @param setId The ID of the set to reset.
   * @returns An Observable emitting the updated session set data.
   */
  resetSet(sessionId: string, setId: string): Observable<SessionServiceResponse<SessionSetDto>> {
    if (!sessionId) {
      return throwError(() => new Error('Session ID is required.'));
    }
    if (!setId) {
      return throwError(() => new Error('Set ID is required.'));
    }

    const url = `/training-sessions/${sessionId}/sets/${setId}/reset`;
    return this.apiService.patch<ResetSessionSetCommand, SessionSetDto>(url, {});
  }
}
