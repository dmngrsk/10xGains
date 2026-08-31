import { TestBed } from '@angular/core/testing';
import { NavigationEnd, NavigationStart, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { NavigationHistoryService } from './navigation-history.service';

describe('NavigationHistoryService', () => {
  let events: Subject<NavigationStart | NavigationEnd>;
  let service: NavigationHistoryService;
  let nextId: number;

  /** One navigation the user starts themselves: a link, a redirect, or the first load. */
  function navigate(url: string): number {
    const id = nextId++;
    events.next(new NavigationStart(id, url, 'imperative'));
    events.next(new NavigationEnd(id, url, url));
    return id;
  }

  /** One history step, back or forward: the browser restores the entry `entryId` created. */
  function popTo(url: string, entryId: number): void {
    const id = nextId++;
    events.next(new NavigationStart(id, url, 'popstate', { navigationId: entryId }));
    events.next(new NavigationEnd(id, url, url));
  }

  beforeEach(() => {
    events = new Subject();
    nextId = 1;

    TestBed.configureTestingModule({
      providers: [{ provide: Router, useValue: { events } }],
    });

    service = TestBed.inject(NavigationHistoryService);
  });

  it('should report nothing behind the first page of a fresh load', () => {
    navigate('/home');

    expect(service.canGoBack).toBe(false);
  });

  it('should report a page behind once the user has navigated', () => {
    navigate('/home');
    navigate('/plans');

    expect(service.canGoBack).toBe(true);
  });

  it('should give up the page behind when the user goes back to the first one', () => {
    const home = navigate('/home');
    navigate('/plans');

    popTo('/home', home);

    expect(service.canGoBack).toBe(false);
  });

  it('should count the forward button as a step in, not another step back', () => {
    const home = navigate('/home');
    const plans = navigate('/plans');
    navigate('/plans/1');

    popTo('/plans', plans);
    popTo('/home', home);
    popTo('/plans', plans);

    expect(service.canGoBack).toBe(true);
  });

  it('should still have the whole trail behind it after going back and forward again', () => {
    const home = navigate('/home');
    const plans = navigate('/plans');
    const detail = navigate('/plans/1');

    popTo('/plans', plans);
    popTo('/home', home);
    popTo('/plans', plans);
    popTo('/plans/1', detail);

    expect(service.canGoBack).toBe(true);
  });

  it('should treat a restored entry that is not ours as a step back', () => {
    navigate('/home');
    navigate('/plans');

    const id = nextId++;
    events.next(new NavigationStart(id, '/home', 'popstate'));
    events.next(new NavigationEnd(id, '/home', '/home'));

    expect(service.canGoBack).toBe(false);
  });

  it('should report how the page on screen was arrived at', () => {
    const home = navigate('/home');
    navigate('/plans');
    expect(service.isPopState).toBe(false);

    popTo('/home', home);
    expect(service.isPopState).toBe(true);

    navigate('/plans');
    expect(service.isPopState).toBe(false);
  });
});
