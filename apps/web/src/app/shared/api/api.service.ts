import { Injectable, inject } from '@angular/core';
import { Observable, from } from 'rxjs';
import { SupabaseService } from '../db/supabase.service';
import { EnvironmentService } from '../services/environment.service';
import { ServerClockService } from '../services/server-clock.service';

export interface ApiServiceResponse<T> {
  data: T | null;
  totalCount?: number;
  error: string | null;
}

interface ApiInternalSuccessResponse<T> { data: T; totalCount?: number; message?: string; timestamp?: string; }
interface ApiInternalErrorResponse { error: string; details?: Record<string, unknown>; code?: string; }

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private supabaseService = inject(SupabaseService);
  private environmentService = inject(EnvironmentService);
  private serverClock = inject(ServerClockService);

  public get<T>(url: string): Observable<ApiServiceResponse<T>> {
    return from(this.request<T>('GET', url));
  }

  public post<TReq extends Record<string, unknown>, T>(url: string, body: TReq): Observable<ApiServiceResponse<T>> {
    return from(this.request<T>('POST', url, body));
  }

  public put<TReq extends Record<string, unknown>, T>(url: string, body: TReq): Observable<ApiServiceResponse<T>> {
    return from(this.request<T>('PUT', url, body));
  }

  public delete(url: string): Observable<ApiServiceResponse<null>> {
    return from(this.request<null>('DELETE', url));
  }

  public patch<TReq extends Record<string, unknown>, T>(url: string, body: TReq): Observable<ApiServiceResponse<T>> {
    return from(this.request<T>('PATCH', url, body));
  }

  private async request<T>(method: string, url: string, body?: Record<string, unknown>): Promise<ApiServiceResponse<T>> {
    const headers: Record<string, string> = {};

    // getSession() refreshes an expired access token before returning it.
    const { data: { session } } = await this.supabaseService.client.auth.getSession();
    if (session) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    // No `credentials` option: the API authenticates via the Authorization
    // header, and its platform CORS is configured without credential support.
    const response = await fetch(this.formatApiUrl(url), {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (response.status === 404 || response.status === 204) {
      return { data: null, error: null };
    }

    if (!response.ok) {
      const errorResponse = await response.json().catch(() => null) as ApiInternalErrorResponse | null;
      throw new Error(errorResponse?.error ?? `Request failed with status ${response.status}`);
    }

    const successResponse = await response.json() as ApiInternalSuccessResponse<T>;
    if (successResponse.timestamp) {
      this.serverClock.sync(successResponse.timestamp);
    }
    return { data: successResponse.data ?? null, totalCount: successResponse.totalCount, error: null };
  }

  private formatApiUrl(url: string): string {
    const baseUrl = this.environmentService.apiUrl.replace(/\/+$/, '');
    return `${baseUrl}/api/` + url.replace(/^\/+|\/+$/g, '');
  }
}
