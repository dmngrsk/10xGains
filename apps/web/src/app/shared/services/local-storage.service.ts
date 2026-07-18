import { Injectable } from '@angular/core';

/**
 * A thin wrapper around `window.localStorage` so components and facades never touch the global
 * directly. Storage access can throw (private browsing, disabled storage, full quota), so every
 * operation degrades to a no-op/null instead of breaking the caller.
 */
@Injectable({
  providedIn: 'root',
})
export class LocalStorageService {
  getItem(key: string): string | null {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  setItem(key: string, value: string): void {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // Storage being unavailable is not worth surfacing; the preference just won't persist.
    }
  }

  removeItem(key: string): void {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Same as above - removal failing is inconsequential.
    }
  }
}
