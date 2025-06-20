import { Injectable, inject } from '@angular/core';
import { Observable, from } from 'rxjs';
import { handleNotFoundHttpError, SupabaseService } from '../db/supabase.service';

export interface ApiServiceResponse<T> {
  data: T | null;
  totalCount?: number;
  error: string | null;
}

type ApiInternalResponse<T> = ApiInternalSuccessResponse<T> | ApiInternalErrorResponse;
interface ApiInternalSuccessResponse<T> { data: T; totalCount?: number; message?: string; }
interface ApiInternalErrorResponse { error: string; details?: Record<string, unknown>; code?: string; }

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private supabaseService = inject(SupabaseService);

  public get<T>(url: string): Observable<ApiServiceResponse<T>> {
    const promise = this.supabaseService.client.functions.invoke<ApiInternalResponse<T>>(this.formatApiUrl(url), { method: 'GET' });
    return from(promise.then(this.handleFunctionResponse));
  }

  public post<TReq extends Record<string, unknown>, T>(url: string, body: TReq): Observable<ApiServiceResponse<T>> {
    const promise = this.supabaseService.client.functions.invoke<ApiInternalResponse<T>>(this.formatApiUrl(url), { method: 'POST', body: body });
    return from(promise.then(this.handleFunctionResponse));
  }

  public put<TReq extends Record<string, unknown>, T>(url: string, body: TReq): Observable<ApiServiceResponse<T>> {
    const promise = this.supabaseService.client.functions.invoke<ApiInternalResponse<T>>(this.formatApiUrl(url), { method: 'PUT', body: body });
    return from(promise.then(this.handleFunctionResponse));
  }

  public delete(url: string): Observable<ApiServiceResponse<null>> {
    const promise = this.supabaseService.client.functions.invoke<ApiInternalResponse<null>>(this.formatApiUrl(url), { method: 'DELETE' });
    return from(promise.then(this.handleFunctionResponse));
  }

  public patch<TReq extends Record<string, unknown>, T>(url: string, body: TReq): Observable<ApiServiceResponse<T>> {
    const promise = this.supabaseService.client.functions.invoke<ApiInternalResponse<T>>(this.formatApiUrl(url), { method: 'PATCH', body: body });
    return from(promise.then(this.handleFunctionResponse));
  }

  private formatApiUrl(url: string): string {
    return 'api/' + url.replace(/^\/+|\/+$/g, "");
  }

  private async handleFunctionResponse<T>(response: { data: ApiInternalResponse<T> | null; error: Error | null }): Promise<ApiServiceResponse<T>> {
    if (!response.error) {
      const successResponse = response.data as ApiInternalSuccessResponse<T>;
      return { data: successResponse.data, totalCount: successResponse.totalCount, error: null };
    } else {
      return { data: handleNotFoundHttpError(response.error), error: null };
    }
  }
}
