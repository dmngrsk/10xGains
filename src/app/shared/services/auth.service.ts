import { Injectable, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, ReplaySubject } from 'rxjs';
import { map, first } from 'rxjs/operators';
import { Session, User } from '@supabase/supabase-js';
import { SupabaseService } from '../db/supabase.service';


export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: User;
  session: Session;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();
  public readonly currentUser = toSignal(this.currentUser$, { initialValue: null });

  private authStateInitialized = new ReplaySubject<boolean>(1);
  public authStateInitialized$ = this.authStateInitialized.asObservable();

  private supabaseService = inject(SupabaseService);
  private router = inject(Router);

  constructor() {
    this.supabaseService.client.auth.getSession().then(({ data: { session } }) => {
      const user = session?.user ?? null;
      this.currentUserSubject.next(user);
      if (!this.isReplaySubjectEmitted(this.authStateInitialized)) {
        this.authStateInitialized.next(true);
      }
    }).catch(() => {
      this.currentUserSubject.next(null);
      if (!this.isReplaySubjectEmitted(this.authStateInitialized)) {
        this.authStateInitialized.next(true);
      }
    });

    this.supabaseService.client.auth.onAuthStateChange((event, session) => {
      const user = session?.user ?? null;
      this.currentUserSubject.next(user);
      if (!this.isReplaySubjectEmitted(this.authStateInitialized)) {
        this.authStateInitialized.next(true);
      }
    });
  }

  private isReplaySubjectEmitted(subject: ReplaySubject<boolean>): boolean {
    let emitted = false;
    const sub = subject.pipe(first()).subscribe(() => {
      emitted = true;
    });
    if (!emitted) {
      sub.unsubscribe();
    }
    return emitted;
  }

  login(request: LoginRequest): Promise<LoginResponse> {
    return new Promise((resolve, reject) => {
      this.supabaseService.client.auth.signInWithPassword({
        email: request.email,
        password: request.password
      })
      .then(({ data, error }) => {
        if (error) {
          reject(error);
          return;
        }
        if (data?.user && data.session) {
          resolve({ user: data.user, session: data.session });
        } else {
          const errMsg = 'Login failed: No user data or session returned';
          reject(new Error(errMsg));
        }
      })
      .catch(err => {
        reject(err);
      });
    });
  }

  async logout(): Promise<void> {
    const { error } = await this.supabaseService.client.auth.signOut();
    if (error) {
      throw error;
    }
    this.router.navigate(['/auth/login']);
  }

  isAuthenticated(): Observable<boolean> {
    return this.currentUser$.pipe(
      map(user => !!user)
    );
  }

  async changePassword(newPassword: string): Promise<void> {
    const { error } = await this.supabaseService.client.auth.updateUser({ password: newPassword });
    if (error) {
      throw error;
    }
  }
}
