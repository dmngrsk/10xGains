import { Injectable, inject } from '@angular/core';
import { NavigationEnd, NavigationStart, Router } from '@angular/router';

/**
 * Tracks how deep into the app the current page is, so a back control can go back rather than
 * navigate forward to a guess at where the user came from.
 *
 * The depth is what the browser's own history holds *for this app*: a fresh load starts at one,
 * each navigation adds an entry, and each `popstate` takes one away. Nothing below one belongs
 * to us - it is whatever the user was looking at before, or a blank tab.
 */
@Injectable({ providedIn: 'root' })
export class NavigationHistoryService {
  private readonly router = inject(Router);

  private depth = 0;
  private currentTrigger: string = 'imperative';

  constructor() {
    this.router.events.subscribe(event => {
      if (event instanceof NavigationStart) {
        this.currentTrigger = event.navigationTrigger ?? 'imperative';
        return;
      }

      if (event instanceof NavigationEnd) {
        this.depth = this.isPopState ? Math.max(0, this.depth - 1) : this.depth + 1;
      }
    });
  }

  /** Whether an entry of this app's own is behind the current one. */
  get canGoBack(): boolean {
    return this.depth > 1;
  }

  /** Whether the page on screen was arrived at by the browser's back or forward buttons. */
  get isPopState(): boolean {
    return this.currentTrigger === 'popstate';
  }
}
