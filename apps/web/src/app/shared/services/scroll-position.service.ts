import { Injectable } from '@angular/core';

/**
 * Remembers how far each page was scrolled, so returning to one by the back button lands where
 * it was left rather than at the top. Keyed by URL, which carries the view and filters a page
 * was showing, so two states of the same route are remembered apart.
 */
@Injectable({ providedIn: 'root' })
export class ScrollPositionService {
  private readonly positions = new Map<string, number>();

  save(url: string, top: number): void {
    this.positions.set(url, top);
  }

  read(url: string): number | undefined {
    return this.positions.get(url);
  }
}
