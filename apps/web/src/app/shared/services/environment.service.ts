import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

/** Access to the runtime environment configuration supplied by `env.js`. */
@Injectable({
  providedIn: 'root'
})
export class EnvironmentService {
  private env = environment;

  get production(): boolean {
    return this.env.name === 'production';
  }

  get apiUrl(): string {
    return this.env.api.url;
  }

  get supabaseUrl(): string {
    return this.env.supabase.url;
  }

  get supabaseKey(): string {
    return this.env.supabase.key;
  }

  get buildName(): string {
    return this.env.build?.name || '';
  }

  get buildVersion(): string {
    return this.env.build?.tag || this.env.build?.sha?.substring(0, 7) || '';
  }
}
