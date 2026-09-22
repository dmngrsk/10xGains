import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { MeasurementsService } from '@features/measurements/api/measurements.service';
import { ProfileService } from '@shared/api/profile.service';
import { AuthService } from '@shared/services/auth.service';
import { SettingsPageFacade } from './settings-page.facade';
import type { MeasurementDto, ProfileDto } from '@txg/shared';

const measurement = (type: string): MeasurementDto =>
  ({ id: `row-${type}`, user_id: 'user-1', measured_on: '2026-09-01', type, value: 40 }) as MeasurementDto;

describe('SettingsPageFacade', () => {
  let getAllMeasurements: ReturnType<typeof vi.fn>;
  let facade: SettingsPageFacade;

  const configure = (profile: Partial<ProfileDto> | null, { failing = false } = {}) => {
    getAllMeasurements = vi.fn().mockReturnValue(
      failing
        ? throwError(() => new Error('boom'))
        : of({ data: [measurement('WAIST'), measurement('NECK')], error: null })
    );

    TestBed.configureTestingModule({
      providers: [
        SettingsPageFacade,
        { provide: MeasurementsService, useValue: { getAllMeasurements } },
        { provide: ProfileService, useValue: { getProfile: () => of({ data: profile, error: null }) } },
        {
          provide: AuthService,
          useValue: {
            currentUser$: of({ id: 'user-1', email: 'test@example.com' }),
            currentUser: () => ({ id: 'user-1' }),
            getIdentities: () => of([]),
          },
        },
      ],
    });

    facade = TestBed.inject(SettingsPageFacade);
  };

  /**
   * The checklist falls back to what has been logged only when the stored set is unset, so that
   * is the only time the history is worth fetching. Asking for it unconditionally paged every
   * measurement the user has on every Settings load, including the tabs that never read it.
   */
  describe('the tracked-types fallback', () => {
    it('should not read the measurement history when the stored set already answers the question', () => {
      configure({ tracked_measurement_types: ['BODY_WEIGHT', 'WAIST'] } as ProfileDto);

      facade.loadInitialData();

      expect(getAllMeasurements).not.toHaveBeenCalled();
    });

    it.each([
      ['null', null],
      ['an empty array', []],
    ])('should read it when the stored set is %s, which means unset', (_label, stored) => {
      configure({ tracked_measurement_types: stored } as ProfileDto);

      facade.loadInitialData();

      expect(getAllMeasurements).toHaveBeenCalledOnce();
      expect(facade.viewModel().measurements.loggedTypes).toEqual(['WAIST', 'NECK']);
    });
  });

  /**
   * Falling back to an empty list here is worse than failing: the checklist seeds as though
   * nothing had ever been logged, and the next Save persists that narrower set - dropping series
   * the user never asked to drop, which is the loss the lookup exists to prevent.
   */
  it('should surface an error rather than seed an empty checklist when the history fails to load', () => {
    configure({ tracked_measurement_types: null } as ProfileDto, { failing: true });

    facade.loadInitialData();

    expect(facade.viewModel().error, 'the notice has something to show').to.not.equal(null);
    expect(facade.viewModel().measurements.trackedTypes).toBeNull();
  });
});
