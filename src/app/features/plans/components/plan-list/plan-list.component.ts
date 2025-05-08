import { Component, OnDestroy, AfterViewInit, ElementRef, ViewChild, signal, WritableSignal, inject, ChangeDetectionStrategy, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { PlanCardComponent } from './plan-card/plan-card.component';
import { PlanCardSkeletonComponent } from './plan-card-skeleton/plan-card-skeleton.component';
import { PlanService, PlanServiceResponse } from '../../services/plan.service';
import { AuthService } from '../../../../shared/services/auth.service';
import { PlanListItemViewModel } from '../../shared/models/plan-list-item.view-model';
import { TrainingPlanDto, TrainingPlanDayDto } from '../../../../shared/api/api.types';
import { FullScreenLayoutComponent } from '../../../../shared/layouts/full-screen-layout/full-screen-layout.component';
import { PlanListEmptyComponent } from './plan-list-empty/plan-list-empty.component';
import { ExerciseService } from '../../../../shared/services/exercise.service';

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
    FullScreenLayoutComponent,
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

  plans: WritableSignal<PlanListItemViewModel[]> = signal([]);
  isLoading: WritableSignal<boolean> = signal(false);
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

    this.plansService.getPlans(user.id, this.limit, this.offset())
      .pipe(
        catchError(error => {
          this.error.set(error.message || 'Failed to connect to the server. Please try again later.');
          this.isLoading.set(false);
          this.hasMore.set(false);
          return of({ data: null, error: { message: error.message } } as PlanServiceResponse);
        })
      )
      .subscribe({
        next: ({ data, error }) => {
          if (error) {
            this.error.set(error.message || 'An error occurred while loading plans.');
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

  navigateToCreatePlan(): void {
    this.router.navigate(['/plans/create']);
  }

  navigateToPlanDetails(planId: string): void {
    this.router.navigate(['/plans', planId]);
  }

  private mapTrainingPlanDtoToViewModel(dto: TrainingPlanDto): PlanListItemViewModel {
    if (!dto) {
      throw new Error('Training plan DTO is required');
    }

    const trainingDays = dto.training_days || [];
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
