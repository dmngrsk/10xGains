import { Injectable, inject } from '@angular/core';
import { createClient, FunctionsHttpError, SupabaseClient } from '@supabase/supabase-js';
import { Database } from './database.types';
import { EnvironmentService } from '../services/environment.service';

/**
 * Factory service for creating a lazy-loaded Supabase client
 */
@Injectable({
  providedIn: 'root'
})
export class SupabaseService {
  private _client: SupabaseClient<Database> | null = null;
  private envService = inject(EnvironmentService);

  public get client(): SupabaseClient<Database> {
    if (!this._client) {
      this._client = createClient<Database>(
        this.envService.supabaseUrl,
        this.envService.supabaseKey
      );
    }
    return this._client;
  }
}

export function handleNotFoundHttpError(error: Error): null {
  if (error instanceof FunctionsHttpError && error.context.status === 404) {
    return null;
  }
  throw error;
}
