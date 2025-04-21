import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { SupabaseService } from '../db/supabase.service';
import { Session, User } from '@supabase/supabase-js';

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

  constructor(
    private supabaseService: SupabaseService,
    private router: Router
  ) {
    this.initializeUser();
  }

  private async initializeUser(): Promise<void> {
    try {
      const { data } = await this.supabaseService.client.auth.getSession();

      if (data?.session?.user) {
        this.currentUserSubject.next(data.session.user);
      }
    } catch (error) {
      console.error('Error initializing user:', error);
      this.currentUserSubject.next(null);
    }
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

        if (data?.user) {
          this.currentUserSubject.next(data.user);
          resolve({ user: data.user, session: data.session });
        } else {
          reject(new Error('Login failed: No user data returned'));
        }
      })
      .catch(reject);
    });
  }

  logout(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.supabaseService.client.auth.signOut()
        .then(({ error }) => {
          if (error) {
            reject(error);
            return;
          }

          this.currentUserSubject.next(null);
          resolve();
        })
        .catch(reject);
    });
  }

  isAuthenticated(): Observable<boolean> {
    return this.currentUser$.pipe(
      map(user => !!user)
    );
  }
}
