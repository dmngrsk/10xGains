import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProfileService } from '@shared/api/profile.service';
import { AuthService } from '@shared/services/auth.service';
import { CallbackComponent } from './callback.component';

const USER_ID = 'user-1';

let authenticatedResponse = { isAuthenticated: true, userId: USER_ID as string | undefined };
let currentUserValue: { user_metadata?: Record<string, unknown> } | null;

describe('CallbackComponent', () => {
  let navigateMock: ReturnType<typeof vi.fn>;
  let snackBarOpenMock: ReturnType<typeof vi.fn>;
  let getProfileMock: ReturnType<typeof vi.fn>;
  let upsertProfileMock: ReturnType<typeof vi.fn>;
  let createDefaultProfileMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    navigateMock = vi.fn();
    snackBarOpenMock = vi.fn();
    getProfileMock = vi.fn();
    upsertProfileMock = vi.fn();
    createDefaultProfileMock = vi.fn().mockReturnValue(of({ data: null, error: null }));
    authenticatedResponse = { isAuthenticated: true, userId: USER_ID };
    currentUserValue = { user_metadata: {} };
  });

  const createComponent = (type: string) => {
    TestBed.configureTestingModule({
      imports: [CallbackComponent],
      providers: [
        { provide: ActivatedRoute, useValue: { queryParams: of({ type }) } },
        { provide: Router, useValue: { navigate: navigateMock } },
        { provide: MatSnackBar, useValue: { open: snackBarOpenMock } },
        { provide: AuthService, useValue: { isAuthenticated: () => of(authenticatedResponse), currentUser$: of(currentUserValue) } },
        { provide: ProfileService, useValue: { getProfile: getProfileMock, upsertProfile: upsertProfileMock, createDefaultProfile: createDefaultProfileMock } },
      ]
    });

    return TestBed.createComponent(CallbackComponent);
  };

  describe('type=oauth', () => {
    it('should seed a new profile with the Google given_name and navigate home', () => {
      getProfileMock.mockReturnValue(of({ data: null, error: null }));
      upsertProfileMock.mockReturnValue(of({ data: { id: USER_ID, first_name: 'Ada' }, error: null }));
      currentUserValue = { user_metadata: { given_name: 'Ada', name: 'Ada Lovelace' } };
      const fixture = createComponent('oauth');

      fixture.detectChanges();

      expect(getProfileMock).toHaveBeenCalledWith(USER_ID);
      expect(upsertProfileMock).toHaveBeenCalledWith(USER_ID, { first_name: 'Ada' });
      expect(navigateMock).toHaveBeenCalledWith(['/home']);
    });

    it('should fall back to the display name when given_name is absent', () => {
      getProfileMock.mockReturnValue(of({ data: null, error: null }));
      upsertProfileMock.mockReturnValue(of({ data: { id: USER_ID, first_name: 'Ada Lovelace' }, error: null }));
      currentUserValue = { user_metadata: { name: 'Ada Lovelace' } };

      createComponent('oauth').detectChanges();

      expect(upsertProfileMock).toHaveBeenCalledWith(USER_ID, { first_name: 'Ada Lovelace' });
    });

    it('should surface an error but still navigate home when profile seeding fails', () => {
      getProfileMock.mockReturnValue(of({ data: null, error: null }));
      upsertProfileMock.mockReturnValue(throwError(() => new Error('boom')));
      currentUserValue = { user_metadata: { given_name: 'Ada' } };

      createComponent('oauth').detectChanges();

      expect(snackBarOpenMock).toHaveBeenCalledWith('Google sign-in finished, but we could not set up your profile. Please try again.', 'Close', { duration: 5000 });
      expect(navigateMock).toHaveBeenCalledWith(['/home']);
    });

    it('should not touch the existing profile of an auto-linked user and navigate home', () => {
      getProfileMock.mockReturnValue(of({ data: { id: USER_ID, first_name: 'Existing' }, error: null }));
      const fixture = createComponent('oauth');

      fixture.detectChanges();

      expect(upsertProfileMock).not.toHaveBeenCalled();
      expect(navigateMock).toHaveBeenCalledWith(['/home']);
    });
  });

  describe('type=oauth-link', () => {
    it('should confirm the connection and navigate to settings without any profile work', () => {
      const fixture = createComponent('oauth-link');

      fixture.detectChanges();

      expect(getProfileMock).not.toHaveBeenCalled();
      expect(upsertProfileMock).not.toHaveBeenCalled();
      expect(snackBarOpenMock).toHaveBeenCalledWith('Google account connected.', 'Close', { duration: 5000 });
      expect(navigateMock).toHaveBeenCalledWith(['/settings']);
    });
  });

  describe('without a session (abandoned or failed OAuth dance)', () => {
    it('should redirect type=oauth to the welcome screen with an error message', () => {
      authenticatedResponse = { isAuthenticated: false, userId: undefined };
      const fixture = createComponent('oauth');

      fixture.detectChanges();

      expect(getProfileMock).not.toHaveBeenCalled();
      expect(snackBarOpenMock).toHaveBeenCalledWith('Google sign-in was not completed. Please try again.', 'Close', { duration: 5000 });
      expect(navigateMock).toHaveBeenCalledWith(['/auth']);
    });

    it('should redirect type=oauth-link to the welcome screen with an error message', () => {
      authenticatedResponse = { isAuthenticated: false, userId: undefined };
      const fixture = createComponent('oauth-link');

      fixture.detectChanges();

      expect(snackBarOpenMock).toHaveBeenCalledWith('Google sign-in was not completed. Please try again.', 'Close', { duration: 5000 });
      expect(navigateMock).toHaveBeenCalledWith(['/auth']);
    });
  });

  describe('type=register', () => {
    it('should create the default profile for the verified user', () => {
      createComponent('register').detectChanges();

      expect(createDefaultProfileMock).toHaveBeenCalledWith(USER_ID);
      expect(navigateMock).toHaveBeenCalledWith(['/auth']);
    });

    it('should report an expired link instead of calling the API without a user id', () => {
      // An expired or reused verification link arrives with no session. Dereferencing the absent id
      // sent `PUT /profiles/undefined`, which 400d with no feedback to the user.
      authenticatedResponse = { isAuthenticated: false, userId: undefined };

      createComponent('register').detectChanges();

      expect(createDefaultProfileMock).not.toHaveBeenCalled();
      expect(snackBarOpenMock.mock.calls[0][0]).toContain('expired');
      expect(navigateMock).toHaveBeenCalledWith(['/auth']);
    });

    it('should surface a failure to create the profile', () => {
      createDefaultProfileMock.mockReturnValue(throwError(() => new Error('boom')));

      createComponent('register').detectChanges();

      expect(snackBarOpenMock.mock.calls[0][0]).toContain('could not finish setting up');
      expect(navigateMock).toHaveBeenCalledWith(['/auth']);
    });
  });

  describe('unknown type', () => {
    it('should show an error and navigate to the welcome screen', () => {
      const fixture = createComponent('bogus');

      fixture.detectChanges();

      expect(snackBarOpenMock).toHaveBeenCalledWith('Invalid callback type.', 'Close', { duration: 5000 });
      expect(navigateMock).toHaveBeenCalledWith(['/auth']);
    });
  });
});
