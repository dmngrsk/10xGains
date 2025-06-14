import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, forkJoin, of } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';
import { SessionService } from '@features/sessions/api/session.service';
import {
  CreateExerciseCommand,
  CreateTrainingPlanDayCommand,
  CreateTrainingPlanExerciseCommand,
  CreateTrainingPlanExerciseSetCommand,
  ExerciseDto,
  TrainingPlanDayDto,
  TrainingPlanDto,
  TrainingPlanExerciseDto,
  TrainingPlanExerciseProgressionDto,
  TrainingPlanExerciseSetDto,
  UpdateTrainingPlanCommand,
  UpdateTrainingPlanDayCommand,
  UpdateTrainingPlanExerciseCommand,
  UpdateTrainingPlanExerciseSetCommand,
  UpsertTrainingPlanExerciseProgressionCommand,
  UserProfileDto,
} from '@shared/api/api.types';
import { ExerciseService } from '@shared/api/exercise.service';
import { ProfileService } from '@shared/api/profile.service';
import { AuthService } from '@shared/services/auth.service';
import { tapIf } from '@shared/utils/operators/tap-if.operator';
import { PlanService, PlanServiceResponse } from '../../api/plan.service';
import { PlanEditPageViewModel, initialPlanEditPageViewModel } from '../../models/plan-edit-page.viewmodel';
import { mapToTrainingPlanViewModel } from '../../models/training-plan.mapping';

@Injectable({
  providedIn: 'root',
})
export class PlanEditPageFacade {
  private readonly planService = inject(PlanService);
  private readonly sessionService = inject(SessionService);
  private readonly exerciseService = inject(ExerciseService);
  private readonly profileService = inject(ProfileService);
  private readonly authService = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly viewModelSignal = signal<PlanEditPageViewModel>(initialPlanEditPageViewModel);
  readonly viewModel = this.viewModelSignal.asReadonly();

  private internalPlanId: string | null = null;
  private internalUserProfile: UserProfileDto | null = null;
  private internalExercises: ExerciseDto[] = [];
  private internalSessionCount: number | null = null;

  loadPlanData(planId: string | null): void {
    if (!planId) {
      this.internalPlanId = null;
      this.viewModelSignal.set({ ...initialPlanEditPageViewModel, error: null, isLoading: false });
      return;
    }

    if (this.internalPlanId !== planId) {
      this.internalPlanId = planId;
      this.internalUserProfile = null;
      this.internalExercises = [];
      this.internalSessionCount = null;
    }

    this.viewModelSignal.update(s => ({ ...s, isLoading: true, error: null, plan: s.plan?.id === planId ? s.plan : null }));

    const profile$ = this.internalUserProfile
      ? of(this.internalUserProfile)
      : this.profileService.getUserProfile(this.authService.currentUser()!.id).pipe(
          map(response => response.data!),
          tapIf(profile => !!profile, profile => this.internalUserProfile = profile),
          catchError(err => this.handleError<UserProfileDto>(err))
        );

    const exercises$ = this.internalExercises.length > 0
      ? of(this.internalExercises)
      : this.exerciseService.getExercises().pipe(
          map(exercises => exercises?.data ?? []),
          tapIf(exercises => !!exercises, exercises => this.internalExercises = exercises),
          catchError(err => this.handleError<ExerciseDto[]>(err))
        );

    const sessionCount$ = this.internalSessionCount != null
      ? of(this.internalSessionCount)
      : this.sessionService.getSessions({ limit: 0, plan_id: planId, status: ['IN_PROGRESS', 'COMPLETED'] }).pipe(
          map(response => response.totalCount!),
          tapIf(count => !!count, count => this.internalSessionCount = count),
          catchError(err => this.handleError<number>(err))
        );

    const plan$ = this.planService.getPlan(planId).pipe(
      catchError(err => this.handleError<PlanServiceResponse<TrainingPlanDto>>(err))
    );

    forkJoin({ profile$, exercises$, sessionCount$, plan$ }).pipe(
      takeUntilDestroyed(this.destroyRef),
      tap(({ profile$: profile, exercises$: exercises, sessionCount$: sessionCount, plan$: plan }) => {
        if (!profile) {
          this.viewModelSignal.update(s => ({ ...s, isLoading: false, error: s.error || 'Failed to load critical user data.'}));
          return;
        }
        if (!exercises || exercises && exercises.length === 0 && !this.internalExercises.length) {
          this.viewModelSignal.update(s => ({ ...s, isLoading: false, error: s.error || 'Failed to load critical exercise data.'}));
          return;
        }
        if (!sessionCount && sessionCount !== 0) {
          this.viewModelSignal.update(s => ({ ...s, isLoading: false, error: s.error || 'Failed to load session data.'}));
          return;
        }

        if (plan && plan.data) {
          const mappedPlan = mapToTrainingPlanViewModel(plan.data, exercises ?? [], profile);
          this.viewModelSignal.update(s => ({ ...s, plan: mappedPlan, isLoading: false, sessionCount: sessionCount, error: null }));
        } else {
          const error = plan?.error || this.viewModel().error || 'Failed to load plan details.';
          this.viewModelSignal.update(s => ({ ...s, plan: null, isLoading: false, error }));
        }
      }),
      catchError(err => this.handleError<void>(err))
    ).subscribe();
  }

  updatePlan(command: UpdateTrainingPlanCommand): Observable<PlanServiceResponse<TrainingPlanDto>> {
    if (!this.internalPlanId) {
      return of({ error: 'No active plan context' } as PlanServiceResponse<TrainingPlanDto>);
    }

    this.viewModelSignal.update(vm => ({ ...vm, isLoading: true, error: null }));

    return this.planService.updatePlan(this.internalPlanId, command).pipe(
      takeUntilDestroyed(this.destroyRef),
      tapIf(response => !response.error && !!this.internalPlanId, () => this.loadPlanData(this.internalPlanId)),
      tapIf(response => !!response.error, response => this.viewModelSignal.update(vm => ({ ...vm, isLoading: false, error: response.error }))),
      catchError(err => this.handleError<PlanServiceResponse<TrainingPlanDto>>(err))
    );
  }

  deletePlan(): Observable<PlanServiceResponse<null>> {
    if (!this.internalPlanId) {
      return of({ error: 'No active plan context' } as PlanServiceResponse<null>);
    }

    this.viewModelSignal.update(vm => ({ ...vm, isLoading: true, error: null }));

    return this.planService.deletePlan(this.internalPlanId).pipe(
      takeUntilDestroyed(this.destroyRef),
      tapIf(response => !response.error, () => this.viewModelSignal.update(vm => ({ ...vm, isLoading: false, plan: null }))),
      tapIf(response => !!response.error, response => this.viewModelSignal.update(vm => ({ ...vm, isLoading: false, error: response.error }))),
      catchError(err => this.handleError<PlanServiceResponse<null>>(err))
    );
  }

  activatePlan(planId: string): Observable<PlanServiceResponse<null>> {
    if (!this.internalPlanId) {
      return of({ error: 'No active plan context' } as PlanServiceResponse<null>);
    }

    const exercises = this.viewModel().plan?.days.flatMap(day => day.exercises);
    const progressions = this.viewModel().plan?.progressions;

    const exercisesWithoutProgressions = exercises?.filter(e => !progressions?.find(p => p.exerciseId === e.exerciseId));
    if (exercisesWithoutProgressions && exercisesWithoutProgressions.length > 0) {
      return of({ error: 'Before activating the plan, you need to define exercise progression strategies for all exercises.' } as PlanServiceResponse<null>);
    }

    this.viewModelSignal.update(vm => ({ ...vm, isLoading: true, error: null }));

    const session$ = this.sessionService.createSession(planId);
    const user$ = this.profileService.upsertUserProfile(this.authService.currentUser()!.id, { active_training_plan_id: planId }).pipe(
      tapIf(response => !!response?.data, response => this.internalUserProfile = response.data!),
      catchError(err => this.handleError<PlanServiceResponse<null>>(err))
    );

    return forkJoin({ session: session$, user: user$}).pipe(
      takeUntilDestroyed(this.destroyRef),
      tapIf(response => !response.user.error, () => this.loadPlanData(this.internalPlanId!)),
      tapIf(response => !!response.user.error, response => this.viewModelSignal.update(vm => ({ ...vm, isLoading: false, error: response.user.error }))),
      map(() => ({ data: null } as PlanServiceResponse<null>)),
      catchError(err => this.handleError<PlanServiceResponse<null>>(err))
    );
  }

  createPlanDay(command: CreateTrainingPlanDayCommand): Observable<PlanServiceResponse<TrainingPlanDayDto>> {
    if (!this.internalPlanId) {
      return of({ error: 'No active plan context' } as PlanServiceResponse<TrainingPlanDayDto>);
    }

    this.viewModelSignal.update(vm => ({ ...vm, isLoading: true, error: null }));

    return this.planService.createPlanDay(this.internalPlanId, command).pipe(
      takeUntilDestroyed(this.destroyRef),
      tapIf(response => !response.error, () => this.loadPlanData(this.internalPlanId!)),
      tapIf(response => !!response.error, response => this.viewModelSignal.update(vm => ({ ...vm, isLoading: false, error: response.error }))),
      catchError(err => this.handleError<PlanServiceResponse<TrainingPlanDayDto>>(err))
    );
  }

  updatePlanDay(dayId: string, command: UpdateTrainingPlanDayCommand): Observable<PlanServiceResponse<TrainingPlanDayDto>> {
    if (!this.internalPlanId) {
      return of({ error: 'No active plan context' } as PlanServiceResponse<TrainingPlanDayDto>);
    }

    this.viewModelSignal.update(vm => ({ ...vm, isLoading: true, error: null }));

    return this.planService.updatePlanDay(this.internalPlanId, dayId, command).pipe(
      takeUntilDestroyed(this.destroyRef),
      tapIf(response => !response.error, () => this.loadPlanData(this.internalPlanId!)),
      tapIf(response => !!response.error, response => this.viewModelSignal.update(vm => ({ ...vm, isLoading: false, error: response.error }))),
      catchError(err => this.handleError<PlanServiceResponse<TrainingPlanDayDto>>(err))
    );
  }

  deletePlanDay(dayId: string): Observable<PlanServiceResponse<null>> {
    if (!this.internalPlanId) {
      return of({ error: 'No active plan context' } as PlanServiceResponse<null>);
    }

    this.viewModelSignal.update(vm => ({ ...vm, isLoading: true, error: null }));

    return this.planService.deletePlanDay(this.internalPlanId, dayId).pipe(
      takeUntilDestroyed(this.destroyRef),
      tapIf(response => !response.error, () => this.loadPlanData(this.internalPlanId!)),
      tapIf(response => !!response.error, response => this.viewModelSignal.update(vm => ({ ...vm, isLoading: false, error: response.error }))),
      catchError(err => this.handleError<PlanServiceResponse<null>>(err))
    );
  }

  createPlanExercise(dayId: string, command: CreateTrainingPlanExerciseCommand): Observable<PlanServiceResponse<TrainingPlanExerciseDto>> {
    if (!this.internalPlanId) {
      return of({ error: 'No active plan context' } as PlanServiceResponse<TrainingPlanExerciseDto>);
    }

    this.viewModelSignal.update(vm => ({ ...vm, isLoading: true, error: null }));

    return this.planService.createPlanExercise(this.internalPlanId, dayId, command).pipe(
      takeUntilDestroyed(this.destroyRef),
      tapIf(response => !response.error, () => this.loadPlanData(this.internalPlanId!)),
      tapIf(response => !!response.error, response => this.viewModelSignal.update(vm => ({ ...vm, isLoading: false, error: response.error }))),
      catchError(err => this.handleError<PlanServiceResponse<TrainingPlanExerciseDto>>(err))
    );
  }

  createGlobalExerciseAndPlanExercise(dayId: string, exerciseCommand: CreateExerciseCommand, planCommand: CreateTrainingPlanExerciseCommand): Observable<PlanServiceResponse<TrainingPlanExerciseDto>> {
    if (!this.internalPlanId) {
      return of({ error: 'No active plan context' } as PlanServiceResponse<TrainingPlanExerciseDto>);
    }

    this.viewModelSignal.update(vm => ({ ...vm, isLoading: true, error: null }));

    return this.exerciseService.createExercise(exerciseCommand).pipe(
      takeUntilDestroyed(this.destroyRef),
      tapIf(response => !!response.error, response => this.viewModelSignal.update(vm => ({ ...vm, isLoading: false, error: response.error }))),
      switchMap(response => {
        if (response.error) {
          return of({ error: response.error } as PlanServiceResponse<TrainingPlanExerciseDto>);
        }

        const create$ = this.createPlanExercise(dayId, { ...planCommand, exercise_id: response.data!.id });
        const exercises$ = this.exerciseService.getExercises().pipe(
          tapIf(exercises => !!exercises.data, exercises => this.internalExercises = exercises.data ?? []),
          catchError(err => this.handleError<ExerciseDto[]>(err))
        );

        return forkJoin({ create$, exercises$ }).pipe(
          map(({ create$, exercises$: _ }) => create$),
          catchError(err => this.handleError<PlanServiceResponse<TrainingPlanExerciseDto>>(err))
        );
      }),
    );
  }

  updatePlanExercise(dayId: string, exerciseId: string, command: UpdateTrainingPlanExerciseCommand): Observable<PlanServiceResponse<TrainingPlanExerciseDto>> {
    if (!this.internalPlanId) {
      return of({ error: 'No active plan context' } as PlanServiceResponse<TrainingPlanExerciseDto>);
    }

    this.viewModelSignal.update(vm => ({ ...vm, isLoading: true, error: null }));

    return this.planService.updatePlanExercise(this.internalPlanId, dayId, exerciseId, command).pipe(
      takeUntilDestroyed(this.destroyRef),
      tapIf(response => !response.error, () => this.loadPlanData(this.internalPlanId!)),
      tapIf(response => !!response.error, response => this.viewModelSignal.update(vm => ({ ...vm, isLoading: false, error: response.error }))),
      catchError(err => this.handleError<PlanServiceResponse<TrainingPlanExerciseDto>>(err))
    );
  }

  deletePlanExercise(dayId: string, exerciseId: string): Observable<PlanServiceResponse<null>> {
    if (!this.internalPlanId) {
      return of({ error: 'No active plan context' } as PlanServiceResponse<null>);
    }

    this.viewModelSignal.update(vm => ({ ...vm, isLoading: true, error: null }));

    return this.planService.deletePlanExercise(this.internalPlanId, dayId, exerciseId).pipe(
      takeUntilDestroyed(this.destroyRef),
      tapIf(response => !response.error, () => this.loadPlanData(this.internalPlanId!)),
      tapIf(response => !!response.error, response => this.viewModelSignal.update(vm => ({ ...vm, isLoading: false, error: response.error }))),
      catchError(err => this.handleError<PlanServiceResponse<null>>(err))
    );
  }

  upsertExerciseProgression(exerciseId: string, command: UpsertTrainingPlanExerciseProgressionCommand): Observable<PlanServiceResponse<TrainingPlanExerciseProgressionDto>> {
    if (!this.internalPlanId) {
      return of({ error: 'No active plan context' } as PlanServiceResponse<TrainingPlanExerciseProgressionDto>);
    }

    this.viewModelSignal.update(vm => ({ ...vm, isLoading: true, error: null }));

    return this.planService.upsertExerciseProgression(this.internalPlanId, exerciseId, command).pipe(
      takeUntilDestroyed(this.destroyRef),
      tapIf(response => !response.error, () => this.loadPlanData(this.internalPlanId!)),
      tapIf(response => !!response.error, response => this.viewModelSignal.update(vm => ({ ...vm, isLoading: false, error: response.error }))),
      catchError(err => this.handleError<PlanServiceResponse<TrainingPlanExerciseProgressionDto>>(err))
    );
  }

  addPlanExerciseSet(dayId: string, exerciseId: string, command: CreateTrainingPlanExerciseSetCommand): Observable<PlanServiceResponse<TrainingPlanExerciseSetDto>> {
    if (!this.internalPlanId) {
      return of({ error: 'No active plan context' } as PlanServiceResponse<TrainingPlanExerciseSetDto>);
    }

    this.viewModelSignal.update(vm => ({ ...vm, isLoading: true, error: null }));

    return this.planService.createPlanExerciseSet(this.internalPlanId, dayId, exerciseId, command).pipe(
      takeUntilDestroyed(this.destroyRef),
      tapIf(response => !response.error, () => this.loadPlanData(this.internalPlanId!)),
      tapIf(response => !!response.error, response => this.viewModelSignal.update(vm => ({ ...vm, isLoading: false, error: response.error }))),
      catchError(err => this.handleError<PlanServiceResponse<TrainingPlanExerciseSetDto>>(err))
    );
  }

  updatePlanExerciseSet(dayId: string, exerciseId: string, setId: string, command: UpdateTrainingPlanExerciseSetCommand): Observable<PlanServiceResponse<TrainingPlanExerciseSetDto>> {
    if (!this.internalPlanId) {
      return of({ error: 'No active plan context' } as PlanServiceResponse<TrainingPlanExerciseSetDto>);
    }

    this.viewModelSignal.update(vm => ({ ...vm, isLoading: true, error: null }));

    return this.planService.updatePlanExerciseSet(this.internalPlanId, dayId, exerciseId, setId, command).pipe(
      takeUntilDestroyed(this.destroyRef),
      tapIf(response => !response.error, () => this.loadPlanData(this.internalPlanId!)),
      tapIf(response => !!response.error, response => this.viewModelSignal.update(vm => ({ ...vm, isLoading: false, error: response.error }))),
      catchError(err => this.handleError<PlanServiceResponse<TrainingPlanExerciseSetDto>>(err))
    );
  }

  deletePlanExerciseSet(dayId: string, exerciseId: string, setId: string): Observable<PlanServiceResponse<null>> {
    if (!this.internalPlanId) {
      return of({ error: 'No active plan context' } as PlanServiceResponse<null>);
    }

    this.viewModelSignal.update(vm => ({ ...vm, isLoading: true, error: null }));

    return this.planService.deletePlanExerciseSet(this.internalPlanId, dayId, exerciseId, setId).pipe(
      takeUntilDestroyed(this.destroyRef),
      tapIf(response => !response.error, () => this.loadPlanData(this.internalPlanId!)),
      tapIf(response => !!response.error, response => this.viewModelSignal.update(vm => ({ ...vm, isLoading: false, error: response.error }))),
      catchError(err => this.handleError<PlanServiceResponse<null>>(err))
    );
  }

  togglePreviewMode(): void {
    this.viewModelSignal.update(s => ({ ...s, isPreview: !s.isPreview }));
  }

  getAvailableExercises(): ExerciseDto[] {
    return this.internalExercises;
  }

  private handleError<T>(err: unknown, defaultMessage: string = 'An unexpected error occurred.'): Observable<T> {
    let message = defaultMessage;

    if (err instanceof Error && err.message) message = err.message;
    if (typeof err === 'string') message = err;
    if (typeof err === 'object' && err !== null && 'error' in err && typeof (err as { error: unknown }).error === 'string') {
      message = (err as { error: string }).error;
    }

    this.viewModelSignal.update(s => ({ ...s, plan: null, isLoading: false, message }));
    return of({ error: message } as T);
  }
}
