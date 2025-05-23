import { CommonModule } from '@angular/common';
import { Component, OnDestroy, AfterViewInit, ElementRef, ViewChild, signal, WritableSignal, inject, ChangeDetectionStrategy, effect, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router, RouterModule } from '@angular/router';
import { catchError, finalize } from 'rxjs/operators';
import { of } from 'rxjs';
import { TrainingPlanDto, TrainingPlanDayDto, CreateTrainingPlanCommand } from '@shared/api/api.types';
import { AuthService } from '@shared/services/auth.service';
import { ExerciseService } from '@shared/services/exercise.service';
import { MainLayoutComponent } from '@shared/ui/layouts/main-layout/main-layout.component';
import { PlanCardComponent } from './plan-card/plan-card.component';
import { PlanCardSkeletonComponent } from './plan-card-skeleton/plan-card-skeleton.component';
import { PlanListEmptyComponent } from './plan-list-empty/plan-list-empty.component';
import { PlanService, PlanServiceResponse } from '../../services/plan.service';
import { PlanListItemViewModel } from '../../shared/models/plan-list-item.view-model';
import { AddEditPlanDialogComponent, AddEditPlanDialogData, AddEditPlanDialogCloseResult } from '../plan-edit/dialogs/add-edit-plan/add-edit-plan-dialog.component';

@Component({
  selector: 'txg-plan-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatSnackBarModule,
    PlanCardComponent,
    PlanCardSkeletonComponent,
    MainLayoutComponent,
    PlanListEmptyComponent
  ],
  templateUrl: './plan-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PlanListComponent implements OnDestroy, AfterViewInit {
  private readonly authService = inject(AuthService);
  private readonly exerciseService = inject(ExerciseService);
  private readonly plansService = inject(PlanService);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  plans: WritableSignal<PlanListItemViewModel[]> = signal([]);
  isLoading: WritableSignal<boolean> = signal(false);
  isCreatingPlan: WritableSignal<boolean> = signal(false);
  error: WritableSignal<string | null> = signal(null);
  offset: WritableSignal<number> = signal(0);
  hasMore: WritableSignal<boolean> = signal(true);

  readonly limit: number = 20;

  @ViewChild('sentinel') sentinel!: ElementRef;
  private intersectionObserver?: IntersectionObserver;

  constructor() {
    let previousUserId: string | null = null;

    effect(() => {
      const user = this.authService.currentUser();
      const currentUserId = user?.id ?? null;

      if (currentUserId && currentUserId !== previousUserId) {
        this.loadPlans();
      } else if (!currentUserId && previousUserId !== null) {
        this.resetState();
      }

      previousUserId = currentUserId;
    });
  }

  ngAfterViewInit(): void {
    this.setupIntersectionObserver();
  }

  ngOnDestroy(): void {
    this.intersectionObserver?.disconnect();
  }

  private resetState(): void {
    this.plans.set([]);
    this.offset.set(0);
    this.hasMore.set(true);
    this.error.set(null);
    this.isLoading.set(false);
  }

  private setupIntersectionObserver(): void {
    if (!this.sentinel?.nativeElement) {
      setTimeout(() => this.setupIntersectionObserver(), 100);
      return;
    }

    this.intersectionObserver?.disconnect();

    this.intersectionObserver = new IntersectionObserver((entries) => {
      const firstEntry = entries[0];
      if (firstEntry.isIntersecting && !this.isLoading() && this.hasMore()) {
        this.loadPlans(true);
      }
    }, { threshold: 0.1 });

    this.intersectionObserver.observe(this.sentinel.nativeElement);
  }

  loadPlans(isLoadMore = false): void {
    const user = this.authService.currentUser();

    if (!user) {
      this.isLoading.set(false);
      return;
    }

    if (!isLoadMore && this.isLoading()) {
      return;
    }

    if (isLoadMore && (!this.hasMore() || this.isLoading())) {
      return;
    }

    if (!isLoadMore) {
      this.resetState();
    }

    this.isLoading.set(true);

    this.plansService.getPlans(this.limit, this.offset())
      .pipe(
        catchError(err => {
          const errorMessage = (err instanceof Error ? err.message : String(err)) || 'Failed to connect to the server. Please try again later.';
          this.error.set(errorMessage);
          this.isLoading.set(false);
          this.hasMore.set(false);
          return of({ data: null, error: errorMessage } as PlanServiceResponse<TrainingPlanDto[]>);
        })
      )
      .subscribe({
        next: ({ data, error }) => {
          if (error) {
            this.error.set(error || 'An error occurred while loading plans.');
            this.hasMore.set(false);
            this.isLoading.set(false);
            return;
          }

          if (!data || data.length === 0) {
            this.hasMore.set(false);
            this.isLoading.set(false);
            return;
          }

          const newPlans = data.map(dto => this.mapTrainingPlanDtoToViewModel(dto));

          if (isLoadMore) {
            this.plans.update(currentPlans => [...currentPlans, ...newPlans]);
          } else {
            this.plans.set(newPlans);
          }

          this.offset.update(currentOffset => currentOffset + data.length);
          this.hasMore.set(data.length === this.limit);
          this.isLoading.set(false);
        }
      });
  }

  openCreatePlanDialog(): void {
    const dialogRef = this.dialog.open<AddEditPlanDialogComponent, AddEditPlanDialogData, AddEditPlanDialogCloseResult>(
      AddEditPlanDialogComponent,
      {
        width: '450px',
        data: { isEditMode: false },
        disableClose: true,
      }
    );

    dialogRef.afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(result => {
        if (result && !('delete' in result)) {
          this.isCreatingPlan.set(true);
          const createCmd: CreateTrainingPlanCommand = result.value as CreateTrainingPlanCommand;
          this.plansService.createPlan(createCmd)
            .pipe(
              finalize(() => this.isCreatingPlan.set(false)),
              takeUntilDestroyed(this.destroyRef)
            )
            .subscribe({
              next: (response: PlanServiceResponse<TrainingPlanDto>) => {
                if (response.data && response.data.id) {
                  this.snackBar.open('Nowy plan został utworzony.', 'OK', { duration: 3000 });
                  this.router.navigate(['/plans', response.data.id, 'edit']);
                  this.loadPlans();
                } else {
                  const errorMessage = response.error || 'Nie udało się utworzyć nowego planu.';
                  this.snackBar.open(errorMessage, 'Zamknij', { duration: 5000 });
                }
              },
              error: (err: Error) => {
                this.snackBar.open(err.message || 'Wystąpił krytyczny błąd podczas tworzenia planu.', 'Zamknij', { duration: 5000 });
              }
            });
        }
      });
  }

  navigateToPlanDetails(planId: string): void {
    this.router.navigate(['plans', planId, 'edit']);
  }

  private mapTrainingPlanDtoToViewModel(dto: TrainingPlanDto): PlanListItemViewModel {
    if (!dto) {
      throw new Error('Training plan DTO is required');
    }

    const trainingDays = dto.days || [];
    const exerciseDescriptions: string[] = [];

    if (trainingDays.length > 0) {
      trainingDays.forEach((day: TrainingPlanDayDto) => {
        const dayExerciseNames: string[] = [];
        const exercisesWithDetails = day.exercises || [];
        if (exercisesWithDetails.length > 0) {
          exercisesWithDetails.forEach(ex => {
            if (ex.exercise_id) {
              const exercise = this.exerciseService.find(ex.exercise_id);
              if (exercise) {
                dayExerciseNames.push(exercise.name);
              }
            }
          });
        }

        exerciseDescriptions.push(dayExerciseNames.join(', '));
      });
    }

    return {
      id: dto.id,
      title: dto.name,
      description: dto.description ? dto.description.substring(0, 100) + (dto.description.length > 100 ? '...' : '') : null,
      exerciseDescriptions: exerciseDescriptions,
    } as PlanListItemViewModel;
  }
}
