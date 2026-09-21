import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProfileService } from '@shared/api/profile.service';
import { AuthService } from '@shared/services/auth.service';
import { LocalStorageService } from '@shared/services/local-storage.service';
import { MeasurementsViewFacade } from './measurements-view.facade';
import { MeasurementsService } from '../../api/measurements.service';
import type { MeasurementDto, MeasurementType, ProfileDto } from '@txg/shared';

function measurement(type: MeasurementType, value: number, measuredOn = '2026-09-01'): MeasurementDto {
  return {
    id: `row-${type}-${measuredOn}`,
    user_id: 'user-1',
    measured_on: measuredOn,
    type,
    value,
    created_at: '2026-09-01T00:00:00.000Z',
    updated_at: '2026-09-01T00:00:00.000Z',
  } as MeasurementDto;
}

describe('MeasurementsViewFacade', () => {
  let facade: MeasurementsViewFacade;
  let store: Map<string, string>;
  let getAllMeasurements: ReturnType<typeof vi.fn>;

  const configure = (profile: Partial<ProfileDto> | null, rows: MeasurementDto[]) => {
    store = new Map<string, string>();
    getAllMeasurements = vi.fn().mockReturnValue(of({ data: rows, error: null }));

    TestBed.configureTestingModule({
      providers: [
        MeasurementsViewFacade,
        {
          provide: MeasurementsService,
          useValue: {
            getAllMeasurements,
            getBodyFatEstimates: () => of({ data: [], error: null }),
          },
        },
        { provide: ProfileService, useValue: { getProfile: () => of({ data: profile, error: null }) } },
        { provide: AuthService, useValue: { currentUser: () => ({ id: 'user-1' }), currentUser$: of({ id: 'user-1' }) } },
        {
          provide: LocalStorageService,
          useValue: {
            getItem: (k: string) => store.get(k) ?? null,
            setItem: (k: string, v: string) => store.set(k, v),
            removeItem: (k: string) => store.delete(k),
          },
        },
      ],
    });
    facade = TestBed.inject(MeasurementsViewFacade);
  };

  /**
   * The charted window is a subset of the rows already fetched for the log dialog's prefill, so
   * asking the API for it again sends the same rows over the wire twice.
   */
  describe('loading', () => {
    it('should fetch the measurements once and narrow the window in memory', () => {
      configure({ body_fat_method: null } as ProfileDto, [
        measurement('BODY_WEIGHT', 80, '2020-01-01'),
        measurement('BODY_WEIGHT', 79, '2026-09-01'),
      ]);

      facade.loadMeasurements();

      expect(getAllMeasurements).toHaveBeenCalledOnce();
    });

    // Tells the first-run empty state apart from a filter that happens to match nothing.
    it('should not claim anything to chart before a single row exists', () => {
      configure({ body_fat_method: null } as ProfileDto, []);

      facade.loadMeasurements();

      expect(facade.viewModel().hasAnyMeasurement).toBe(false);
    });

    it('should count a stored row', () => {
      configure({ body_fat_method: null } as ProfileDto, [measurement('BODY_WEIGHT', 79)]);

      facade.loadMeasurements();

      expect(facade.viewModel().hasAnyMeasurement).toBe(true);
    });

    it('should keep every row available to the dialog even when the chart window excludes it', () => {
      configure({ body_fat_method: null } as ProfileDto, [
        measurement('BODY_WEIGHT', 80, '2020-01-01'),
      ]);

      facade.loadMeasurements();

      expect(facade.buildLogDialogData().lastValues['BODY_WEIGHT']?.value).toBe(80);
    });
  });

  /**
   * kg, cm and % share no scale, so a third unit would need a third axis nobody can read. The
   * oldest unit group gives way, which keeps the series just selected visible.
   */
  describe('toggleSeries', () => {
    beforeEach(() => {
      configure({ body_fat_method: null } as ProfileDto, [
        measurement('BODY_WEIGHT', 79),
        measurement('WAIST', 84),
        measurement('SKINFOLD_CHEST', 12),
      ]);
      facade.loadMeasurements();
    });

    const selectedIds = () => facade.viewModel().series.filter(s => s.selected).map(s => s.id);

    it('should plot two units at once', () => {
      facade.toggleSeries('WAIST');

      expect(selectedIds()).toEqual(['BODY_WEIGHT', 'WAIST']);
    });

    it('should drop the oldest unit rather than show a third axis', () => {
      facade.toggleSeries('WAIST');
      facade.toggleSeries('SKINFOLD_CHEST');

      // kg gave way; the cm and mm series are what remain.
      expect(selectedIds()).toEqual(['WAIST', 'SKINFOLD_CHEST']);
    });

    it('should turn a selected series off again', () => {
      facade.toggleSeries('WAIST');
      facade.toggleSeries('BODY_WEIGHT');

      expect(selectedIds()).toEqual(['WAIST']);
    });

    // An empty chart is a dead end: nothing is drawn, so nothing suggests which chip to press.
    it('should refuse to turn off the last selected series', () => {
      facade.toggleSeries('BODY_WEIGHT');

      expect(selectedIds()).toEqual(['BODY_WEIGHT']);
    });

    it('should leave the remembered selection untouched when a toggle is refused', () => {
      facade.toggleSeries('WAIST');
      facade.toggleSeries('BODY_WEIGHT');
      facade.toggleSeries('WAIST');

      expect(JSON.parse(store.get('txg.measurements.series.NONE')!)).toEqual(['WAIST']);
    });
  });

  /**
   * A selection is a per-method answer: the chips that exist under JP-7 are not the ones the tape
   * method charts, so one flat selection replayed across both would empty the chart.
   */
  describe('remembering the chip selection', () => {
    it('should persist the selection under the method in force', () => {
      configure({ body_fat_method: 'NAVY' } as ProfileDto, [
        measurement('BODY_WEIGHT', 79),
        measurement('WAIST', 84),
      ]);
      facade.loadMeasurements();

      facade.toggleSeries('WAIST');
      facade.toggleSeries('BODY_WEIGHT');

      expect(JSON.parse(store.get('txg.measurements.series.NAVY')!)).toEqual(['WAIST']);
    });

    it('should replay a remembered selection instead of the defaults', () => {
      configure({ body_fat_method: 'NAVY' } as ProfileDto, [
        measurement('BODY_WEIGHT', 79),
        measurement('WAIST', 84),
      ]);
      store.set('txg.measurements.series.NAVY', JSON.stringify(['WAIST']));

      facade.loadMeasurements();

      expect(facade.viewModel().series.filter(s => s.selected).map(s => s.id)).toEqual(['WAIST']);
    });

    it('should keep each method\'s answer apart', () => {
      configure({ body_fat_method: 'JP7' } as ProfileDto, [measurement('BODY_WEIGHT', 79)]);
      store.set('txg.measurements.series.NAVY', JSON.stringify([]));

      facade.loadMeasurements();

      // The Navy entry says nothing about JP-7, so JP-7 falls back to its own defaults.
      expect(facade.viewModel().series.filter(s => s.selected).map(s => s.id)).toEqual(['BODY_WEIGHT']);
    });

    it('should survive storage that throws or returns nonsense', () => {
      configure({ body_fat_method: 'NAVY' } as ProfileDto, [measurement('BODY_WEIGHT', 79)]);
      store.set('txg.measurements.series.NAVY', 'not json');

      facade.loadMeasurements();

      expect(facade.viewModel().series.filter(s => s.selected).map(s => s.id)).toEqual(['BODY_WEIGHT']);
    });
  });

  /**
   * What the round asks for: everything the user tracks, in catalog order. The dialog groups it
   * by instrument from that, so the order it arrives in is the order it is presented in.
   */
  describe('buildLogDialogData', () => {
    it('should offer the tracked types in catalog order, whatever order they were stored in', () => {
      configure(
        { tracked_measurement_types: ['SKINFOLD_CHEST', 'WAIST', 'BODY_WEIGHT', 'NECK'] } as ProfileDto,
        [measurement('BODY_WEIGHT', 79)]
      );
      facade.loadMeasurements();

      // Scale, then tape, then calipers - the order every other surface reads in.
      expect(facade.buildLogDialogData().types)
        .toEqual(['BODY_WEIGHT', 'NECK', 'WAIST', 'SKINFOLD_CHEST']);
    });

    it('should prefill from the last reading of each type', () => {
      configure({ tracked_measurement_types: ['BODY_WEIGHT'] } as ProfileDto, [
        measurement('BODY_WEIGHT', 80, '2026-08-01'),
        measurement('BODY_WEIGHT', 79, '2026-09-01'),
      ]);
      facade.loadMeasurements();

      expect(facade.buildLogDialogData().lastValues['BODY_WEIGHT']).toEqual({
        value: 79,
        measuredOn: '2026-09-01',
      });
    });

  });
});

/**
 * A failed load must look failed.
 *
 * Each request used to catch its own error and hand back an empty result, which the page could
 * not tell apart from "nothing recorded yet" - so a user with a year of history saw the first-run
 * prompt, and the outer handler that raises the error notice never ran at all.
 */
describe('MeasurementsViewFacade when a request fails', () => {
  const configureFailing = (failing: 'measurements' | 'estimates' | 'profile') => {
    const boom = () => throwError(() => new Error('boom'));

    TestBed.configureTestingModule({
      providers: [
        MeasurementsViewFacade,
        {
          provide: MeasurementsService,
          useValue: {
            getAllMeasurements: failing === 'measurements'
              ? boom
              : () => of({ data: [measurement('BODY_WEIGHT', 79)], error: null }),
            getBodyFatEstimates: failing === 'estimates' ? boom : () => of({ data: [], error: null }),
          },
        },
        {
          provide: ProfileService,
          useValue: {
            getProfile: failing === 'profile'
              ? boom
              : () => of({ data: { body_fat_method: null } as ProfileDto, error: null }),
          },
        },
        { provide: AuthService, useValue: { currentUser: () => ({ id: 'user-1' }), currentUser$: of({ id: 'user-1' }) } },
        {
          provide: LocalStorageService,
          useValue: { getItem: () => null, setItem: () => undefined, removeItem: () => undefined },
        },
      ],
    });

    return TestBed.inject(MeasurementsViewFacade);
  };

  it.each(['measurements', 'estimates', 'profile'] as const)(
    'should raise the error notice when the %s request fails',
    (failing) => {
      const failingFacade = configureFailing(failing);

      failingFacade.loadMeasurements();

      expect(failingFacade.viewModel().error, 'the notice has something to show').to.not.equal(null);
      expect(failingFacade.viewModel().isLoading).toBe(false);
    }
  );

  // The first-run prompt is the one state a failure must never be mistaken for: it invites the
  // user to log their first round when they may already have years of them.
  it('should not claim the user has nothing recorded', () => {
    const failingFacade = configureFailing('measurements');

    failingFacade.loadMeasurements();

    expect(failingFacade.viewModel().hasAnyMeasurement).toBe(false);
    expect(failingFacade.viewModel().error).to.not.equal(null);
  });
});
