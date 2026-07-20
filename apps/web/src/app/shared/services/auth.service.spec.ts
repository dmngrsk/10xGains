import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProfileService } from '@shared/api/profile.service';
import { AuthService } from './auth.service';
import { SupabaseService } from '../db/supabase.service';

describe('AuthService (Google OAuth)', () => {
  let service: AuthService;
  let signInWithOAuthMock: ReturnType<typeof vi.fn>;
  let linkIdentityMock: ReturnType<typeof vi.fn>;
  let unlinkIdentityMock: ReturnType<typeof vi.fn>;
  let getUserIdentitiesMock: ReturnType<typeof vi.fn>;

  const googleIdentity = { id: '1', identity_id: 'identity-1', user_id: 'user-1', provider: 'google', identity_data: {} };
  const emailIdentity = { id: '2', identity_id: 'identity-2', user_id: 'user-1', provider: 'email', identity_data: {} };

  beforeEach(() => {
    signInWithOAuthMock = vi.fn();
    linkIdentityMock = vi.fn();
    unlinkIdentityMock = vi.fn();
    getUserIdentitiesMock = vi.fn();

    const clientMock = {
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
        onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
        signInWithOAuth: signInWithOAuthMock,
        linkIdentity: linkIdentityMock,
        unlinkIdentity: unlinkIdentityMock,
        getUserIdentities: getUserIdentitiesMock,
      }
    };

    TestBed.configureTestingModule({
      providers: [
        AuthService,
        { provide: SupabaseService, useValue: { client: clientMock } },
        { provide: ProfileService, useValue: { createDefaultProfile: vi.fn() } },
      ]
    });
    service = TestBed.inject(AuthService);
  });

  describe('loginWithGoogle', () => {
    it('should start the OAuth flow with the google provider and the oauth callback redirect', async () => {
      signInWithOAuthMock.mockResolvedValue({ data: { provider: 'google', url: 'https://accounts.google.com' }, error: null });

      const result = await firstValueFrom(service.loginWithGoogle());

      expect(signInWithOAuthMock).toHaveBeenCalledWith({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/auth/callback?type=oauth` },
      });
      expect(result).toEqual({ success: true });
    });

    it('should surface the Supabase error when the flow cannot start', async () => {
      signInWithOAuthMock.mockResolvedValue({ data: {}, error: { message: 'provider is not enabled' } });

      const result = await firstValueFrom(service.loginWithGoogle());

      expect(result).toEqual({ success: false, error: 'provider is not enabled' });
    });
  });

  describe('linkGoogleIdentity', () => {
    it('should start the linking flow with the oauth-link callback redirect', async () => {
      linkIdentityMock.mockResolvedValue({ data: { provider: 'google', url: 'https://accounts.google.com' }, error: null });

      const result = await firstValueFrom(service.linkGoogleIdentity());

      expect(linkIdentityMock).toHaveBeenCalledWith({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/auth/callback?type=oauth-link` },
      });
      expect(result).toEqual({ success: true });
    });

    it('should surface the Supabase error when manual linking is disabled', async () => {
      linkIdentityMock.mockResolvedValue({ data: {}, error: { message: 'manual linking is disabled' } });

      const result = await firstValueFrom(service.linkGoogleIdentity());

      expect(result).toEqual({ success: false, error: 'manual linking is disabled' });
    });
  });

  describe('unlinkGoogleIdentity', () => {
    it('should unlink the google identity when one is linked', async () => {
      getUserIdentitiesMock.mockResolvedValue({ data: { identities: [emailIdentity, googleIdentity] }, error: null });
      unlinkIdentityMock.mockResolvedValue({ data: {}, error: null });

      const result = await firstValueFrom(service.unlinkGoogleIdentity());

      expect(unlinkIdentityMock).toHaveBeenCalledWith(googleIdentity);
      expect(result).toEqual({ success: true });
    });

    it('should fail without calling unlink when no google identity is linked', async () => {
      getUserIdentitiesMock.mockResolvedValue({ data: { identities: [emailIdentity] }, error: null });

      const result = await firstValueFrom(service.unlinkGoogleIdentity());
      
      expect(unlinkIdentityMock).not.toHaveBeenCalled();
      expect(result).toEqual({ success: false, error: 'No Google account is linked.' });
    });

    it('should surface the error when the identities cannot be fetched', async () => {
      getUserIdentitiesMock.mockResolvedValue({ data: null, error: { message: 'not authenticated' } });

      const result = await firstValueFrom(service.unlinkGoogleIdentity());

      expect(unlinkIdentityMock).not.toHaveBeenCalled();
      expect(result).toEqual({ success: false, error: 'not authenticated' });
    });
  });

  describe('getIdentities', () => {
    it('should return the identities of the current user', async () => {
      getUserIdentitiesMock.mockResolvedValue({ data: { identities: [emailIdentity, googleIdentity] }, error: null });

      const result = await firstValueFrom(service.getIdentities());

      expect(result).toEqual([emailIdentity, googleIdentity]);
    });

    it('should error when the identities are unavailable', async () => {
      getUserIdentitiesMock.mockResolvedValue({ data: null, error: { message: 'not authenticated' } });

      await expect(firstValueFrom(service.getIdentities())).rejects.toThrow('not authenticated');
    });
  });

  describe('user-facing error messages', () => {
    const friendly = (message: string): string =>
      (service as unknown as { toFriendlyError(m: string): string }).toFriendlyError(message);

    it.each([
      ['Invalid login credentials', 'do not match an account'],
      ['Email not confirmed', 'confirm your email address'],
      ['User already registered', 'already exists'],
      ['Password should be at least 6 characters', 'at least 6 characters'],
      ['For security purposes, you can only request this after 45 seconds', 'wait a moment'],
      ['Failed to fetch', 'check your connection'],
    ])('should rewrite %p into copy written for the user', (raw, expected) => {
      const result = friendly(raw);

      expect(result).toContain(expected);
      expect(result).not.toBe(raw);
    });

    it('should pass an unrecognised message through unchanged', () => {
      // Better an unfamiliar but specific message than a generic apology that says nothing.
      expect(friendly('provider is not enabled')).toBe('provider is not enabled');
    });

    it('should surface the mapped message through an auth response', async () => {
      getUserIdentitiesMock.mockResolvedValue({ data: null, error: { message: 'Invalid login credentials' } });

      const result = await firstValueFrom(service.unlinkGoogleIdentity());

      expect(result.success).toBe(false);
      expect(result.error).toContain('do not match an account');
    });
  });
});
