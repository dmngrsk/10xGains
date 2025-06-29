import { Injectable, inject } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { ApiService, ApiServiceResponse } from './api.service';
import { ProfileDto, UpsertProfileCommand } from './api.types';

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
   * @returns An Observable emitting a `ProfileServiceResponse` containing the `ProfileDto`.
   * Throws an error if the userId is not provided.
   */
  getProfile(userId: string): Observable<ProfileServiceResponse<ProfileDto>> {
    if (!userId) {
      return throwError(() => new Error('User ID is required to get user profile.'));
    }

    const url = `/profiles/${userId}`;
    return this.apiService.get<ProfileDto>(url)
  }

  /**
   * Creates a default, empty user profile for a given user ID.
   * @param userId The unique identifier of the user whose profile is to be created.
   * @returns An Observable emitting a `ProfileServiceResponse` containing the created `ProfileDto`.
   * Throws an error if the userId is not provided.
   */
  createDefaultProfile(userId: string): Observable<ProfileServiceResponse<ProfileDto>> {
    if (!userId) {
      return throwError(() => new Error('User ID is required to create default user profile.'));
    }

    return this.upsertProfile(userId, { first_name: '' });
  }

  /**
   * Creates or updates the user profile for a given user ID.
   * @param userId The unique identifier of the user whose profile is to be updated.
   * @param command The command object containing the profile data to update.
   * @returns An Observable emitting a `ProfileServiceResponse` containing the updated `ProfileDto`.
   * Throws an error if the userId or command is not provided.
   */
  upsertProfile(userId: string, command: UpsertProfileCommand): Observable<ProfileServiceResponse<ProfileDto>> {
    if (!userId) {
      return throwError(() => new Error('User ID is required to update user profile.'));
    }

    const url = `/profiles/${userId}`;
    return this.apiService.put<UpsertProfileCommand, ProfileDto>(url, command);
  }
}
