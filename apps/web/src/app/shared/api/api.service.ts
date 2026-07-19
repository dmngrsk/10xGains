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

/** The largest page size the API accepts (`optionalLimit`'s MAX_LIMIT). */
const MAX_PAGE_SIZE = 100;

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

  /**
   * Retrieves every item of a paginated collection, following pages until `totalCount` is reached.
   *
   * List endpoints cap their page size (20 by default, 100 at most), so a plain `get` against a
   * collection returns a silently truncated view of it. Callers that need a complete catalog - the
   * exercise lookup every feature builds its names from, the plan filters on history and progress -
   * must use this instead, or entries beyond the first page simply go missing.
   *
   * @param url The collection URL, with or without an existing query string.
   * @param pageSize Rows per request; defaults to the server's maximum to minimise round trips.
   * @returns An Observable emitting the concatenated items of every page.
   */
  public getAll<T>(url: string, pageSize: number = MAX_PAGE_SIZE): Observable<ApiServiceResponse<T[]>> {
    return from(this.requestAll<T>(url, pageSize));
  }

  private async requestAll<T>(url: string, pageSize: number): Promise<ApiServiceResponse<T[]>> {
    const items: T[] = [];
    let offset = 0;

    for (;;) {
      const page = await this.request<T[]>('GET', this.appendPageParams(url, pageSize, offset));

      // A 404 (or any empty body) means there is nothing more to collect.
      if (!page.data) {
        break;
      }

      items.push(...page.data);

      // An endpoint that reports no total is not paginated; take the single response as complete.
      // Otherwise stop once the total is covered, and defensively on an empty page so that a
      // miscounted total can never spin this loop forever.
      if (page.totalCount === undefined || items.length >= page.totalCount || page.data.length === 0) {
        return { data: items, totalCount: page.totalCount ?? items.length, error: null };
      }

      offset += page.data.length;
    }

    return { data: items, totalCount: items.length, error: null };
  }

  private appendPageParams(url: string, limit: number, offset: number): string {
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}limit=${limit}&offset=${offset}`;
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
