import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

/**
 * Service to provide access to environment variables
 * Angular automatically swaps the environment.ts import with the appropriate
 * environment file based on the build configuration through fileReplacements
 */
@Injectable({
  providedIn: 'root'
})
export class EnvironmentService {
  private env = environment;

  get production(): boolean {
    return this.env.production;
  }

  get supabaseUrl(): string {
    return this.env.supabase.url;
  }

  get supabaseKey(): string {
    return this.env.supabase.key;
  }

  get buildName(): string {
    return this.env.build?.name ?? '';
  }

  get buildSha(): string {
    return this.env.build?.sha?.startsWith('v') ? this.env.build.sha : this.env.build?.sha.substring(0, 7) ?? '';
  }
}
