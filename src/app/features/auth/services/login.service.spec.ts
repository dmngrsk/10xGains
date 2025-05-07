import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { expect, describe, it, beforeEach, vi } from 'vitest';

import { LoginService } from '../components/login/services/login.service';
import { AuthService, LoginResponse } from '../../../shared/services/auth.service';
import { User, Session } from '@supabase/supabase-js';

describe('LoginService', () => {
  let service: LoginService;
  let authServiceMock: {
    login: ReturnType<typeof vi.fn>;
    isAuthenticated: ReturnType<typeof vi.fn>;
  };
  let routerMock: {
    navigate: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    authServiceMock = {
      login: vi.fn(),
      isAuthenticated: vi.fn()
    };

    routerMock = {
      navigate: vi.fn()
    };

    TestBed.configureTestingModule({
      providers: [
        LoginService,
        { provide: AuthService, useValue: authServiceMock },
        { provide: Router, useValue: routerMock }
      ]
    });

    service = TestBed.inject(LoginService);
  });

  it('should be created', () => {
    expect(service).toBeDefined();
  });

  describe('login', () => {
    it('should navigate to home page on successful login', async () => {
      const credentials = { email: 'test@example.com', password: 'password' };
      const mockUser: Partial<User> = { id: 'user1' };
      const mockSession: Partial<Session> = { access_token: 'token' };
      const mockResponse: LoginResponse = {
        user: mockUser as User,
        session: mockSession as Session
      };

      authServiceMock.login.mockResolvedValue(mockResponse);
      routerMock.navigate.mockResolvedValue(true);

      await service.login(credentials);

      expect(authServiceMock.login).toHaveBeenCalledWith(credentials);
      expect(routerMock.navigate).toHaveBeenCalledWith(['/home']);
    });

    it('should throw an error when email is empty', async () => {
      const credentials = { email: '', password: 'password' };

      await expect(service.login(credentials)).rejects.toThrow('Email and password are required.');
    });

    it('should throw an error when password is empty', async () => {
      const credentials = { email: 'test@example.com', password: '' };

      await expect(service.login(credentials)).rejects.toThrow('Email and password are required.');
    });

    it('should map authentication errors to user-friendly messages', async () => {
      const credentials = { email: 'test@example.com', password: 'password' };

      authServiceMock.login.mockRejectedValue({ message: 'Invalid login credentials' });

      await expect(service.login(credentials)).rejects.toThrow('Invalid email or password.');
    });
  });

  describe('redirectIfAuthenticated', () => {
    it('should redirect to home page if user is authenticated', async () => {
      authServiceMock.isAuthenticated.mockReturnValue(of(true));
      routerMock.navigate.mockResolvedValue(true);

      await service.redirectIfAuthenticated();

      expect(routerMock.navigate).toHaveBeenCalledWith(['/home']);
    });

    it('should not redirect if user is not authenticated', async () => {
      authServiceMock.isAuthenticated.mockReturnValue(of(false));

      await service.redirectIfAuthenticated();

      expect(routerMock.navigate).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      authServiceMock.isAuthenticated.mockReturnValue(throwError(() => new Error('Test error')));

      // This should not throw
      await service.redirectIfAuthenticated();

      expect(routerMock.navigate).not.toHaveBeenCalled();
    });
  });
});
