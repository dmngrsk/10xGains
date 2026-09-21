import { Injectable, computed, inject, signal } from '@angular/core';
import { EMPTY, Observable, forkJoin } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { MeasurementsService, MeasurementsServiceResponse } from '@features/measurements/api/measurements.service';
import {
  defaultSelectedSeriesIds,
  describeEstimateBlocker,
  mapToLastValues,
  mapToMeasurementSeries,
  resolveTrackedTypes,
} from '@features/measurements/models/measurements.mapping';
import {
  LogMeasurementDialogData,
  MeasurementFiltersViewModel,
  MeasurementsViewModel,
} from '@features/measurements/models/measurements.viewmodel';
import { ProfileService } from '@shared/api/profile.service';
import { AuthService } from '@shared/services/auth.service';
import { LocalStorageService } from '@shared/services/local-storage.service';
import { resetOnUserChange } from '@shared/utils/auth/reset-on-user-change';
import { wouldEmptySelection } from '@shared/utils/charts/series-selection';
import { toCalendarDate } from '@shared/utils/dates/calendar-date';
import { presetToRange } from '@shared/utils/dates/date-range-presets';
import type { DateRangePreset } from '@shared/utils/dates/date-range-presets';
import type {
  BodyFatMethod,
  CreateMeasurementCommand,
  MeasurementDto,
  MeasurementType,
  ProfileDto,
} from '@txg/shared';

const SERIES_STORAGE_PREFIX = 'txg.measurements.series.';
const DEFAULT_RANGE_PRESET: DateRangePreset = '1Y';

const initialViewModel: MeasurementsViewModel = {
  series: [],
  filters: { dateRange: { preset: DEFAULT_RANGE_PRESET, dateFrom: null, dateTo: null } },
  estimateBlockedReason: null,
  hasAnyMeasurement: false,
  isLoading: false,
  error: null,
};

@Injectable()
export class MeasurementsViewFacade {
  private readonly measurementsService = inject(MeasurementsService);
  private readonly profileService = inject(ProfileService);
  private readonly authService = inject(AuthService);
  private readonly localStorage = inject(LocalStorageService);

  readonly viewModel = signal<MeasurementsViewModel>(initialViewModel);

  private readonly measurements = signal<MeasurementDto[]>([]);
  private readonly profile = signal<ProfileDto | null>(null);
  private readonly selectedIds = signal<Set<string> | null>(null);
  private readonly currentUser = computed(() => this.authService.currentUser());

  constructor() {
    resetOnUserChange(() => this.clearUserScopedState());
  }

  loadMeasurements(): void {
    this.viewModel.update(vm => ({ ...vm, isLoading: true, error: null }));

    const user = this.currentUser();
    if (!user) {
      this.viewModel.update(vm => ({
        ...vm,
        isLoading: false,
        error: 'Failed to load your session. Please sign in again.',
      }));
      return;
    }

    const { dateFrom, dateTo } = this.viewModel().filters.dateRange;

    /*
     * No per-request fallback. Each of these used to swallow its own failure and hand back an
     * empty result, which read as "you have nothing" rather than "we could not load it": a 500 on
     * the measurements request showed a user with a year of history the first-run prompt, and a
     * failed profile request told someone who had chosen a method to go and choose one. It also
     * left the outer handler below unreachable, so the error notice and its Try Again button
     * could never appear. Letting them throw is what makes that notice the only wrong-looking
     * state the page can reach.
     */
    forkJoin({
      profile: this.profileService.getProfile(user.id).pipe(map(res => res.data)),
      allMeasurements: this.measurementsService.getAllMeasurements().pipe(map(res => res.data ?? [])),
      estimates: this.measurementsService.getBodyFatEstimates({
        date_from: toCalendarBound(dateFrom),
        date_to: toCalendarBound(dateTo),
      }).pipe(map(res => res.data ?? [])),
    }).pipe(
      catchError((error: Error) => {
        console.error('Error loading measurements:', error);
        this.viewModel.update(vm => ({
          ...vm,
          isLoading: false,
          error: 'Failed to load your measurements. Please try again later.',
          series: [],
        }));
        return EMPTY;
      })
    ).subscribe(({ profile, allMeasurements, estimates }) => {
      this.profile.set(profile);
      this.measurements.set(allMeasurements);

      const from = toCalendarBound(dateFrom);
      const to = toCalendarBound(dateTo);
      const measurements = allMeasurements.filter(row =>
        (!from || row.measured_on >= from) && (!to || row.measured_on <= to));

      const method = profile?.body_fat_method ?? null;
      const selected = this.selectedIds()
        ?? this.readStoredSelection(method)
        ?? defaultSelectedSeriesIds(method);
      this.selectedIds.set(selected);

      this.viewModel.update(vm => ({
        ...vm,
        series: mapToMeasurementSeries(
          measurements,
          estimates,
          id => selected.has(id),
          method,
          this.trackedTypes()
        ),
        estimateBlockedReason: describeEstimateBlocker(profile, allMeasurements, estimates),
        hasAnyMeasurement: allMeasurements.length > 0,
        isLoading: false,
        error: null,
      }));
    });
  }

  updateFilters(filters: MeasurementFiltersViewModel): void {
    this.viewModel.update(vm => ({ ...vm, filters: { ...vm.filters, ...filters } }));
    this.loadMeasurements();
  }

  toggleSeries(seriesId: string): void {
    this.viewModel.update(vm => {
      const target = vm.series.find(s => s.id === seriesId);
      if (!target) {
        return vm;
      }

      if (wouldEmptySelection(vm.series, target)) {
        return vm;
      }

      if (target.selected) {
        return { ...vm, series: vm.series.map(s => s.id === seriesId ? { ...s, selected: false } : s) };
      }


      const selectedUnits: string[] = [];
      for (const s of vm.series) {
        if (s.selected && !selectedUnits.includes(s.unit)) {
          selectedUnits.push(s.unit);
        }
      }

      const unitIsNew = !selectedUnits.includes(target.unit);
      const droppedUnit = unitIsNew && selectedUnits.length >= 2 ? selectedUnits[0] : null;

      return {
        ...vm,
        series: vm.series.map(s => {
          if (s.id === seriesId) {
            return { ...s, selected: true };
          }
          return droppedUnit !== null && s.unit === droppedUnit ? { ...s, selected: false } : s;
        }),
      };
    });

    this.rememberSelection();
  }

  saveMeasurements(commands: CreateMeasurementCommand[]): Observable<MeasurementsServiceResponse<MeasurementDto[]>> {
    return this.measurementsService.createMeasurements(commands).pipe(
      tap(() => this.loadMeasurements())
    );
  }

  buildLogDialogData(): LogMeasurementDialogData {
    return {
      types: this.trackedTypes(),
      lastValues: mapToLastValues(this.measurements()),
    };
  }

  seedDateRange(): void {
    this.viewModel.update(vm => ({
      ...vm,
      filters: {
        dateRange: {
          preset: DEFAULT_RANGE_PRESET,
          ...presetToRange(DEFAULT_RANGE_PRESET, new Date()),
        },
      },
    }));
  }

  private trackedTypes(): MeasurementType[] {
    return resolveTrackedTypes(
      this.profile()?.tracked_measurement_types as MeasurementType[] | null | undefined,
      this.measurements().map(row => row.type)
    );
  }

  private readStoredSelection(method: BodyFatMethod | null): Set<string> | null {
    const raw = this.localStorage.getItem(SERIES_STORAGE_PREFIX + (method ?? 'NONE'));
    if (!raw) {
      return null;
    }

    try {
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? new Set(parsed.filter(id => typeof id === 'string')) : null;
    } catch {
      return null;
    }
  }
  
  private rememberSelection(): void {
    const selected = this.viewModel().series.filter(s => s.selected).map(s => s.id);
    const method = this.profile()?.body_fat_method ?? null;

    this.selectedIds.set(new Set(selected));
    this.localStorage.setItem(SERIES_STORAGE_PREFIX + (method ?? 'NONE'), JSON.stringify(selected));
  }

  private clearUserScopedState(): void {
    this.measurements.set([]);
    this.profile.set(null);
    this.selectedIds.set(null);
    this.viewModel.set(initialViewModel);
  }
}

function toCalendarBound(value: string | null): string | undefined {
  return value ? toCalendarDate(new Date(value)) : undefined;
}
