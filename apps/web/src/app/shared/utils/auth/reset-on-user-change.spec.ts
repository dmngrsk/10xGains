import { Injectable, runInInjectionContext, Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BehaviorSubject } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resetOnUserChange } from './reset-on-user-change';
import { AuthService } from '../../services/auth.service';

interface TestUser { id: string }

@Injectable()
class AuthServiceStub {
  readonly users$ = new BehaviorSubject<TestUser | null>(null);
  readonly currentUser$ = this.users$.asObservable();

  signIn(id: string): void {
    this.users$.next({ id });
  }

  signOut(): void {
    this.users$.next(null);
  }
}

describe('resetOnUserChange', () => {
  let auth: AuthServiceStub;
  let injector: Injector;
  let reset: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        AuthServiceStub,
        { provide: AuthService, useExisting: AuthServiceStub },
      ]
    });
    auth = TestBed.inject(AuthServiceStub);
    injector = TestBed.inject(Injector);
    reset = vi.fn();
  });

  const register = () => runInInjectionContext(injector, () => resetOnUserChange(reset));

  it('should not reset for the user who is already signed in', () => {
    auth.signIn('user-1');
    register();

    expect(reset).not.toHaveBeenCalled();
  });

  it('should reset when a different user signs in', () => {
    auth.signIn('user-1');
    register();

    auth.signIn('user-2');

    expect(reset).toHaveBeenCalledTimes(1);
  });

  it('should reset on sign-out, rather than leaving the caches for whoever signs in next', () => {
    auth.signIn('user-1');
    register();

    auth.signOut();

    expect(reset).toHaveBeenCalledTimes(1);
  });

  it('should reset once per user change across a full sign-out and sign-in', () => {
    auth.signIn('user-1');
    register();

    auth.signOut();
    auth.signIn('user-2');

    expect(reset).toHaveBeenCalledTimes(2);
  });

  it('should ignore repeat emissions for the same user, such as a token refresh', () => {
    auth.signIn('user-1');
    register();

    auth.signIn('user-1');
    auth.signIn('user-1');

    expect(reset).not.toHaveBeenCalled();
  });
});
