import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { from, switchMap } from 'rxjs';
import { SupabaseService } from '../db/supabase.service';

/**
 * Interceptor that adds authorization headers to HTTP requests
 * Uses the current Supabase session token for authentication
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const supabaseService = inject(SupabaseService);

  return from(supabaseService.client.auth.getSession()).pipe(
    switchMap(({ data }) => {
      if (data?.session?.access_token) {
        const authReq = req.clone({
          setHeaders: {
            Authorization: `Bearer ${data.session.access_token}`
          }
        });
        return next(authReq);
      }

      return next(req);
    })
  );
};
