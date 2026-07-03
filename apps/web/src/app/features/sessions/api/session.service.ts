import { Injectable, inject } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { ApiService, ApiServiceResponse } from '@shared/api/api.service';
import { CompleteSessionSetCommand,
  CreateSessionSetCommand,
  CreateSessionCommand,
  FailSessionSetCommand,
  ResetSessionSetCommand,
  SessionSetDto,
  SessionDto,
  UpdateSessionSetCommand
} from '@shared/api/api.types';

export interface GetSessionsParams {
  limit?: number;
  offset?: number;
  sort?: string;
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
   * Retrieves a list of sessions based on query parameters.
   * @param params Query parameters for filtering and ordering sessions.
   * @returns An Observable emitting an array of session data.
   */
  getSessions(params: GetSessionsParams): Observable<SessionServiceResponse<SessionDto[]>> {
    const queryParams = new URLSearchParams();
    let url = '/sessions';

    if (params.limit !== undefined) {
      queryParams.append('limit', params.limit.toString());
    }
    if (params.offset !== undefined) {
      queryParams.append('offset', params.offset.toString());
    }
    if (params.sort !== undefined) {
      queryParams.append('sort', params.sort);
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
    if (params.plan_id) {
      queryParams.append('plan_id', params.plan_id);
    }

    const queryString = queryParams.toString();
    if (queryString) {
      url += `?${queryString}`;
    }

    return this.apiService.get<SessionDto[]>(url);
  }

  /**
   * Retrieves the details of a specific session.
   * @param sessionId The ID of the session to retrieve.
   * @returns An Observable emitting the session data.
   */
  getSession(sessionId: string): Observable<SessionServiceResponse<SessionDto>> {
    if (!sessionId) {
      return throwError(() => new Error('Session ID is required.'));
    }

    const url = `/sessions/${sessionId}`;
    return this.apiService.get<SessionDto>(url);
  }

  /**
   * Creates a new session from a plan.
   * Does not specify a day, allowing the backend to pick the next available day.
   * @param planId The ID of the plan.
   * @returns An Observable emitting the created session data.
   */
  createSession(planId: string): Observable<SessionServiceResponse<SessionDto>> {
    if (!planId) {
      return throwError(() => new Error('Plan ID is required to create a session from a plan.'));
    }

    const url = `/sessions`;
    return this.apiService.post<CreateSessionCommand, SessionDto>(url, { plan_id: planId });
  }

  /**
   * Marks a session as complete.
   * @param sessionId The ID of the session to complete.
   * @returns An Observable emitting the updated session data.
   */
  completeSession(sessionId: string): Observable<SessionServiceResponse<SessionDto>> {
    if (!sessionId) {
      return throwError(() => new Error('Session ID is required to complete the session.'));
    }

    const url = `/sessions/${sessionId}/complete`;
    return this.apiService.post<Record<string, never>, SessionDto>(url, {});
  }

  /**
   * Adds a new set to a session.
   * @param command The command object containing the details for the new set.
   * @returns An Observable emitting the created session set data.
   */
  createSet(command: CreateSessionSetCommand): Observable<SessionServiceResponse<SessionSetDto>> {
    if (!command.session_id) {
      return throwError(() => new Error('session_id is required in CreateSessionSetCommand for addSet operation.'));
    }
    if (!command.plan_exercise_id) {
      return throwError(() => new Error('plan_exercise_id is required in CreateSessionSetCommand for addSet operation.'));
    }

    const url = `/sessions/${command.session_id}/sets`;
    return this.apiService.post<CreateSessionSetCommand, SessionSetDto>(url, command);
  }

  /**
   * Updates the details of a specific set within a session.
   * @param sessionId The ID of the session.
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

    const url = `/sessions/${sessionId}/sets/${setId}`;
    return this.apiService.put<Partial<UpdateSessionSetCommand>, SessionSetDto>(url, command);
  }

  /**
   * Deletes a specific set from a session.
   * @param sessionId The ID of the session.
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

    const url = `/sessions/${sessionId}/sets/${setId}`;
    return this.apiService.delete(url);
  }

  /**
   * Marks a specific set within a session as complete.
   * @param sessionId The ID of the session.
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

    const url = `/sessions/${sessionId}/sets/${setId}/complete`;
    return this.apiService.patch<CompleteSessionSetCommand, SessionSetDto>(url, {});
  }

  /**
   * Marks a specific set within a session as failed.
   * @param sessionId The ID of the session.
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

    const url = `/sessions/${sessionId}/sets/${setId}/fail?reps=${actualReps}`;
    return this.apiService.patch<FailSessionSetCommand, SessionSetDto>(url, {});
  }

  /**
   * Resets a specific set within a session to its initial state.
   * @param sessionId The ID of the session.
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

    const url = `/sessions/${sessionId}/sets/${setId}/reset`;
    return this.apiService.patch<ResetSessionSetCommand, SessionSetDto>(url, {});
  }
}
