import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, of, switchMap, forkJoin } from 'rxjs';
import { catchError, finalize, map } from 'rxjs/operators';
import { TrainingPlanViewModel } from '@features/plans/models/training-plan.viewmodel';
import { CreateTrainingPlanCommand, TrainingPlanDto, ExerciseDto, UserProfileDto } from '@shared/api/api.types';
import { ExerciseService } from '@shared/api/exercise.service';
import { ProfileService } from '@shared/api/profile.service';
import { AuthService } from '@shared/services/auth.service';
import { PlanService, PlanServiceResponse } from '../../api/plan.service';
import { PlanListPageViewModel } from '../../models/plan-list-page.viewmodel';
import { mapToTrainingPlanViewModel } from '../../models/training-plan.mapping';

const PLAN_PAGE_SIZE = 5;

const initialState: PlanListPageViewModel = {
  activePlan: null,
  plans: [],
  totalPlans: 0,
  isLoading: false,
  error: null,
};

@Injectable({
  providedIn: 'root',
})
export class PlanListPageFacade {
  private readonly authService = inject(AuthService);
  private readonly exerciseService = inject(ExerciseService);
  private readonly plansService = inject(PlanService);
  private readonly profileService = inject(ProfileService);
  private readonly destroyRef = inject(DestroyRef);

  readonly viewModel = signal(initialState);

  private internalUserProfile: UserProfileDto | null = null;
  private internalExercises: ExerciseDto[] = [];
  private internalActivePlanViewModel: TrainingPlanViewModel | null = null;

  loadPlanData(isLoadMore = false): void {
    const offset = isLoadMore ? this.viewModel().plans.length : 0;

    const initialUpdatePayload = isLoadMore
      ? { isLoading: true, error: null }
      : { activePlan: null, plans: [], totalPlans: 0, isLoading: true, error: null };

    this.viewModel.update(s => ({ ...s, ...initialUpdatePayload }));

    this.plansService.getPlans(PLAN_PAGE_SIZE, offset).pipe(
      switchMap(plansResponse => {
        return this.getInitialData(isLoadMore).pipe(
          map(({ userProfile, exercises, activePlanViewModel }) => ({
            plansResponse,
            userProfile,
            exercises,
            activePlanViewModel
          }))
        );
      }),
      map(data => {
        const { plansResponse, userProfile, exercises, activePlanViewModel } = data;
        const viewModel = this.viewModel();

        if (plansResponse.error || !plansResponse.data) {
          const errorMessage = plansResponse.error || 'An error occurred while loading plans.';
          return {
            activePlan: activePlanViewModel ?? viewModel.activePlan,
            plans: viewModel.plans,
            totalPlans: viewModel.totalPlans,
            isLoading: false,
            error: errorMessage
          };
        }

        const newMappedPlans = plansResponse.data.map(dto => mapToTrainingPlanViewModel(dto, exercises, userProfile!)).filter(p => !p.isActive);
        const updatedPlans = [...viewModel.plans, ...newMappedPlans];
        const newTotalPlans = plansResponse.totalCount ?? viewModel.totalPlans;

        return {
          activePlan: activePlanViewModel ?? viewModel.activePlan,
          plans: updatedPlans,
          totalPlans: newTotalPlans,
          isLoading: false,
          error: null
        };
      }),
      catchError(err => {
        const errorMessage = (err instanceof Error ? err.message : String(err)) || 'Failed to connect to the server.';
        const viewModel = this.viewModel();
        return of({
          activePlan: viewModel.activePlan,
          plans: viewModel.plans,
          totalPlans: viewModel.totalPlans,
          isLoading: false,
          error: errorMessage
        });
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(finalViewModelState => {
      this.viewModel.set(finalViewModelState);
    });
  }

  createPlan(createCmd: CreateTrainingPlanCommand): Observable<PlanServiceResponse<TrainingPlanDto>> {
    this.viewModel.update(s => ({ ...s, isLoading: true, error: null }));
    return this.plansService.createPlan(createCmd)
      .pipe(
        finalize(() => this.viewModel.update(s => ({ ...s, isLoading: false }))),
        takeUntilDestroyed(this.destroyRef)
      );
  }

  private getInitialData(isLoadMore: boolean): Observable<{
    userProfile: UserProfileDto;
    exercises: ExerciseDto[];
    activePlanViewModel: TrainingPlanViewModel | null;
  }> {
    if (this.internalUserProfile && this.internalExercises.length > 0 && isLoadMore) {
      return of({ userProfile: this.internalUserProfile, exercises: this.internalExercises, activePlanViewModel: this.internalActivePlanViewModel });
    }

    return this.profileService
      .getUserProfile(this.authService.currentUser()!.id)
      .pipe(switchMap(profileResponse => {
        if (profileResponse.error || !profileResponse.data) {
          throw profileResponse.error || new Error('Failed to load user profile.');
        } else {
          this.internalUserProfile = profileResponse.data;
        }
        return forkJoin({
          exercises: this.exerciseService.getExercises(),
          activePlan: this.plansService.getPlan(profileResponse.data.active_training_plan_id!)
        }).pipe(map(({ exercises, activePlan }) => {
          if (exercises.data && exercises.data.length === 0) {
            console.warn('Exercise list is empty. Plans might not map exercise names correctly.');
          } else {
            this.internalExercises = exercises.data ?? [];
          }
          if (activePlan.error || !activePlan.data) {
            throw activePlan.error || new Error('Failed to load active plan.');
          } else {
            this.internalActivePlanViewModel = mapToTrainingPlanViewModel(activePlan.data, this.internalExercises, this.internalUserProfile);
          }
          return { userProfile: this.internalUserProfile!, exercises: this.internalExercises, activePlanViewModel: this.internalActivePlanViewModel };
        }));
      }));
  }
}
