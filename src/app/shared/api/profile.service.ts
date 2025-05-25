import { Injectable, inject } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { ApiService, ApiServiceResponse } from './api.service';
import { UserProfileDto } from './api.types';

export type ProfileServiceResponse<T> = ApiServiceResponse<T>;

/**
 * Service responsible for handling user profile related API operations.
 */
@Injectable({
  providedIn: 'root',
})
export class ProfileService {
  private readonly apiService = inject(ApiService);

  /**
   * Retrieves the user profile for a given user ID.
   * @param userId The unique identifier of the user whose profile is to be fetched.
   * @returns An Observable emitting a `ProfileServiceResponse` containing the `UserProfileDto`.
   * Throws an error if the userId is not provided.
   */
  getUserProfile(userId: string): Observable<ProfileServiceResponse<UserProfileDto>> {
    if (!userId) {
      return throwError(() => new Error('User ID is required to get user profile.'));
    }
    const url = `user-profiles/${userId}`;
    return this.apiService.get<UserProfileDto>(url)
  }
}
