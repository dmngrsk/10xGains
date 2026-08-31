import { Injectable, inject } from '@angular/core';
import { NavigationEnd, NavigationStart, Router } from '@angular/router';

/**
 * Tracks how deep into the app the current page is, so a back control can go back rather than
 * navigate forward to a guess at where the user came from.
 *
 * The depth is what the browser's own history holds *for this app*: a fresh load starts at one,
 * each navigation adds an entry, and each step back takes one away. Nothing below one belongs
 * to us - it is whatever the user was looking at before, or a blank tab.
 */
@Injectable({ providedIn: 'root' })
export class NavigationHistoryService {
  private readonly router = inject(Router);

  private depth = 0;
  private currentTrigger: string = 'imperative';
  private currentEntryId = 0;
  private pendingEntryId = 0;
  private pendingStep = 1;

  constructor() {
    this.router.events.subscribe(event => {
      if (event instanceof NavigationStart) {
        this.currentTrigger = event.navigationTrigger ?? 'imperative';

        // `popstate` is the browser's forward button as much as its back one, and counting both
        // as a step back walks the depth down to zero while the user is still inside the app.
        // A restored entry carries the id of the navigation that first created it, so comparing
        // it with the entry on screen says which way this one went. An entry not of ours has no
        // id to compare; treat it as a step back, the safe way to be wrong - the back control
        // then falls back to its route instead of leaving the app.
        const restoredEntryId = event.restoredState?.navigationId;
        this.pendingEntryId = restoredEntryId ?? event.id;
        this.pendingStep = this.isPopState && (restoredEntryId ?? 0) <= this.currentEntryId ? -1 : 1;
        return;
      }

      if (event instanceof NavigationEnd) {
        this.depth = Math.max(0, this.depth + this.pendingStep);
        this.currentEntryId = this.pendingEntryId;
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
