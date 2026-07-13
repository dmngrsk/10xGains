import { Injectable, computed, inject, signal } from '@angular/core';
import { EMPTY, forkJoin, of } from 'rxjs';
import { PlanDto, ProfileDto } from '@txg/shared';
import { catchError, map, tap } from 'rxjs/operators';
import { PlanService } from '@features/plans/api/plan.service';
import { GetExerciseProgressParams, ProgressService } from '@features/progress/api/progress.service';
import { ProgressFiltersViewModel, ProgressPageViewModel } from '@features/progress/models/progress-page.viewmodel';
import { mapToExerciseSeriesViewModels, presetToDateFrom } from '@features/progress/models/progress.mapping';
import { ProfileService } from '@shared/api/profile.service';
import { AuthService } from '@shared/services/auth.service';

const initialProgressPageViewModel: ProgressPageViewModel = {
  series: [],
  filters: {
    selectedPlanId: null,
    dateRangePreset: '3M',
    availablePlans: [],
  },
  isLoading: false,
  error: null,
};

@Injectable({
  providedIn: 'root',
})
export class ProgressPageFacade {
  private readonly progressService = inject(ProgressService);
  private readonly planService = inject(PlanService);
  private readonly profileService = inject(ProfileService);
  private readonly authService = inject(AuthService);

  readonly viewModel = signal<ProgressPageViewModel>(initialProgressPageViewModel);
  private readonly internalPlans = signal<PlanDto[]>([]);
  private readonly currentUser = computed(() => this.authService.currentUser());

  loadProgressPageData(): void {
    this.viewModel.update(vm => ({ ...vm, isLoading: true, error: null }));
    const user = this.currentUser();

    forkJoin({
      plans: this.planService.getPlans().pipe(map(res => res.data || []), catchError(() => of([] as PlanDto[]))),
      profile: this.profileService.getProfile(user!.id).pipe(map(res => res.data), catchError(() => of(null as ProfileDto | null)))
    }).pipe(
      tap(({ plans, profile }) => {
        this.internalPlans.set(plans);

        const availablePlans = plans.map(p => ({ id: p.id, name: p.name }));
        const activePlanId = profile?.active_plan_id;
        const selectedPlanId = activePlanId && plans.some(p => p.id === activePlanId) ? activePlanId : null;

        this.viewModel.update(vm => ({
          ...vm,
          filters: { ...vm.filters, availablePlans, selectedPlanId }
        }));

        this.loadProgress({ selectAll: true });
      }),
      catchError((error: Error) => {
        console.error('Error in initial data loading sequence:', error);
        this.viewModel.update(vm => ({
          ...vm,
          isLoading: false,
          error: 'Failed to load initial page configuration. Please try again later.'
        }));
        return of(null);
      })
    ).subscribe();
  }

  loadProgress(options: { selectAll: boolean }): void {
    const filters = this.viewModel().filters;

    this.viewModel.update(vm => ({ ...vm, isLoading: true, error: null }));

    const queryParams: GetExerciseProgressParams = {
      plan_id: filters.selectedPlanId ?? undefined,
      date_from: presetToDateFrom(filters.dateRangePreset, new Date()),
    };

    const previousSeries = this.viewModel().series;
    const previousIds = new Set(previousSeries.map(s => s.exerciseId));
    const previouslySelectedIds = new Set(previousSeries.filter(s => s.selected).map(s => s.exerciseId));

    const isSelected = (exerciseId: string) =>
      options.selectAll || previouslySelectedIds.has(exerciseId) || !previousIds.has(exerciseId);

    this.progressService.getExerciseProgress(queryParams).pipe(
      map(response => mapToExerciseSeriesViewModels(response.data ?? [], this.internalPlans(), isSelected)),
      catchError((error: Error) => {
        console.error('Error loading exercise progress:', error);
        this.viewModel.update(vm => ({
          ...vm,
          isLoading: false,
          error: 'Failed to load exercise progress. Please try again later.',
          series: []
        }));
        return EMPTY;
      })
    ).subscribe(series => {
      this.viewModel.update(vm => ({
        ...vm,
        series,
        isLoading: false,
        error: null
      }));
    });
  }

  updateFilters(newFilters: ProgressFiltersViewModel): void {
    const planChanged = newFilters.selectedPlanId !== this.viewModel().filters.selectedPlanId;

    this.viewModel.update(vm => ({
      ...vm,
      filters: { ...vm.filters, ...newFilters }
    }));

    this.loadProgress({ selectAll: planChanged });
  }

  toggleExercise(exerciseId: string): void {
    this.viewModel.update(vm => ({
      ...vm,
      series: vm.series.map(s => s.exerciseId === exerciseId ? { ...s, selected: !s.selected } : s)
    }));
  }
}
