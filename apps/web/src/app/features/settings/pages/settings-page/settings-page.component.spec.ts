import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsPageComponent } from './settings-page.component';
import { SettingsPageFacade } from './settings-page.facade';

const VIEW_MODE_KEY = 'txg.settings.view-mode';

describe('SettingsPageComponent', () => {
  let navigateMock: ReturnType<typeof vi.fn>;
  let dialogOpenMock: ReturnType<typeof vi.fn>;

  const createComponent = (queryParams: Record<string, string> = {}) => {
    TestBed.configureTestingModule({
      providers: [
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(queryParams) } } },
        { provide: Router, useValue: { navigate: navigateMock } },
        { provide: MatDialog, useValue: { open: dialogOpenMock } },
        { provide: MatSnackBar, useValue: { open: vi.fn() } },
        {
          provide: SettingsPageFacade,
          useValue: { viewModel: signal({ isLoading: false, error: null }).asReadonly(), loadInitialData: vi.fn() },
        },
      ],
    });

    // The view resolution under test is wired in ngOnInit; the template plays no part in it.
    const component = TestBed.runInInjectionContext(() => new SettingsPageComponent());
    component.ngOnInit();
    return component;
  };

  const lastSyncedView = () => navigateMock.mock.lastCall?.[1]?.queryParams?.view;

  beforeEach(() => {
    navigateMock = vi.fn();
    dialogOpenMock = vi.fn().mockReturnValue({ afterClosed: () => of(undefined) });
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
    history.replaceState(null, '');
    TestBed.resetTestingModule();
  });

  describe('view resolution', () => {
    it('should open on the workout view by default, and write it to the URL', () => {
      const component = createComponent();

      expect(component.viewMode()).toBe('workout');
      expect(lastSyncedView()).toBe('workout');
      expect(navigateMock.mock.lastCall?.[1]).toMatchObject({ replaceUrl: true, queryParamsHandling: 'merge' });
    });

    it('should open on the view named in the URL', () => {
      expect(createComponent({ view: 'user' }).viewMode()).toBe('user');
    });

    it('should open on the remembered view when the URL names none', () => {
      window.localStorage.setItem(VIEW_MODE_KEY, 'user');

      expect(createComponent().viewMode()).toBe('user');
    });

    it('should prefer the URL over the remembered view', () => {
      window.localStorage.setItem(VIEW_MODE_KEY, 'user');

      expect(createComponent({ view: 'workout' }).viewMode()).toBe('workout');
    });

    it('should ignore unknown values at each step', () => {
      window.localStorage.setItem(VIEW_MODE_KEY, 'bogus');

      expect(createComponent({ view: 'nonsense' }).viewMode()).toBe('workout');
    });

    it('should open on the user view for the change password action, whatever is remembered', () => {
      window.localStorage.setItem(VIEW_MODE_KEY, 'workout');
      history.replaceState({ action: 'changePassword' }, '');

      const component = createComponent({ view: 'workout' });

      expect(component.viewMode()).toBe('user');
      expect(dialogOpenMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('switching views', () => {
    it('should remember the view and write it to the URL', () => {
      const component = createComponent();

      component.onViewModeChanged('user');

      expect(component.viewMode()).toBe('user');
      expect(window.localStorage.getItem(VIEW_MODE_KEY)).toBe('user');
      expect(lastSyncedView()).toBe('user');
    });
  });
});
