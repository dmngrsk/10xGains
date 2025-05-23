import { Injectable, inject } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { ApiService, ApiServiceResponse } from '@shared/api/api.service';
import { UserProfileDto } from '@shared/api/api.types';

export type ProfileServiceResponse<T> = ApiServiceResponse<T>;

@Injectable({
  providedIn: 'root',
})
export class ProfileService {
  private readonly apiService = inject(ApiService);

  getUserProfile(userId: string): Observable<ProfileServiceResponse<UserProfileDto>> {
    if (!userId) {
      return throwError(() => new Error('User ID is required to get user profile.'));
    }
    const url = `user-profiles/${userId}`;
    return this.apiService.get<UserProfileDto>(url)
  }
}
