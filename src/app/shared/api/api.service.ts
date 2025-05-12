import { Injectable, inject } from '@angular/core';
import { Observable, from, map } from 'rxjs';
import { SupabaseService } from '../db/supabase.service';

export interface ApiServiceResponse<T> {
  data: T | null;
  error: string | null;
}

type ApiInternalResponse<T> = ApiInternalSuccessResponse<T> | ApiInternalErrorResponse;
interface ApiInternalSuccessResponse<T> { data: T; message?: string; }
interface ApiInternalErrorResponse { error: string; details?: Record<string, unknown>; code?: string; }

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private supabaseService = inject(SupabaseService);

  public get<T>(url: string): Observable<ApiServiceResponse<T>> {
    const promise = this.supabaseService.client.functions.invoke<ApiInternalResponse<T>>(url, { method: 'GET' });
    return from(promise).pipe(map(r => this.handleFunctionResponse(r)));
  }

  public post<TReq extends Record<string, unknown>, T>(url: string, body: TReq): Observable<ApiServiceResponse<T>> {
    const promise = this.supabaseService.client.functions.invoke<ApiInternalResponse<T>>(url, { method: 'POST', body: body });
    return from(promise).pipe(map(r => this.handleFunctionResponse(r)));
  }

  public put<TReq extends Record<string, unknown>, T>(url: string, body: TReq): Observable<ApiServiceResponse<T>> {
    const promise = this.supabaseService.client.functions.invoke<ApiInternalResponse<T>>(url, { method: 'PUT', body: body });
    return from(promise).pipe(map(r => this.handleFunctionResponse(r)));
  }

  public delete(url: string): Observable<ApiServiceResponse<null>> {
    const promise = this.supabaseService.client.functions.invoke<ApiInternalResponse<null>>(url, { method: 'DELETE' });
    return from(promise).pipe(map(r => this.handleFunctionResponse(r)));
  }

  private handleFunctionResponse<T>(functionsResponse: { data: ApiInternalResponse<T> | null; error: Error | null }): ApiServiceResponse<T> {
    return {
      data: functionsResponse.error ? null : (functionsResponse.data as ApiInternalSuccessResponse<T>)?.data ?? null,
      error: functionsResponse.error?.message ?? (functionsResponse.data as ApiInternalErrorResponse)?.error ?? null,
    };
  }
}
