import { CommonModule } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize } from 'rxjs'
import { TrainingPlanDto } from '@shared/api/api.types';
import { ExerciseService } from '@shared/services/exercise.service';
import { ConfirmationDialogComponent, ConfirmationDialogData } from '@shared/ui/dialogs/confirmation-dialog/confirmation-dialog.component';
import { MainLayoutComponent } from '@shared/ui/layouts/main-layout/main-layout.component';
import { AddEditDayDialogCloseResult, AddEditDayDialogComponent, AddEditDayDialogData } from './dialogs/add-edit-day/add-edit-day-dialog.component';
import { AddEditPlanDialogComponent } from './dialogs/add-edit-plan/add-edit-plan-dialog.component';
import { AddEditSetDialogComponent, AddEditSetDialogData, AddEditSetDialogCloseResult } from './dialogs/add-edit-set/add-edit-set-dialog.component';
import { AddExerciseDialogComponent, AddExerciseDialogData, AddExerciseDialogCloseResult } from './dialogs/add-exercise/add-exercise-dialog.component';
import { EditExerciseProgressionDialogComponent, EditExerciseProgressionDialogData, EditExerciseProgressionDialogCloseResult } from './dialogs/edit-exercise-progression/edit-exercise-progression-dialog.component';
import { PlanDayListComponent } from './plan-day-list/plan-day-list.component';
import { PlanMetadataComponent } from './plan-metadata/plan-metadata.component';
import { PlanService, PlanServiceResponse } from '../../services/plan.service';

@Component({
  selector: 'txg-plan-edit',
  templateUrl: './plan-edit.component.html',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatProgressBarModule,
    MatIconModule,
    MainLayoutComponent,
    PlanDayListComponent,
    PlanMetadataComponent,
  ],
})
export class PlanEditComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly planService = inject(PlanService);
  private readonly exerciseService = inject(ExerciseService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialog = inject(MatDialog);

  protected readonly planSignal = signal<TrainingPlanDto | null>(null);
  protected readonly daysSignal = computed(() => this.planSignal()?.days ?? []);
  protected readonly previewSignal = signal(false);
  protected readonly loadingSignal = signal(false);
  protected readonly errorSignal = signal<string | null>(null);

  constructor() {
    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(params => {
        const idFromRoute = params.get('planId');
        if (idFromRoute) {
          this.getPlan(idFromRoute);
        } else {
          this.planSignal.set(null);
          this.errorSignal.set('Invalid plan ID or route. Plan could not be loaded.');
        }
      });
  }

  private getPlan(planId: string) {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);
    this.planService.getPlan(planId)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.loadingSignal.set(false))
      )
      .subscribe({
        next: (response: PlanServiceResponse<TrainingPlanDto>) => {
          if (response.data) {
            this.planSignal.set(structuredClone(response.data));
          } else {
            let errorMessage = 'Failed to load plan.';
            if (response.error) {
              errorMessage = response.error || 'Unknown error while loading plan.';
            }
            this.errorSignal.set(errorMessage);
            this.planSignal.set(null);
          }
        },
        error: (err: Error) => {
          this.errorSignal.set(err.message || 'A critical error occurred while loading the plan.');
          this.planSignal.set(null);
        }
      });
  }

  editPlan = () => {
    const plan = this.planSignal();

    if (!plan || !plan.id) {
      this.snackBar.open('Plan data is not available for editing.', 'Close', { duration: 3000 });
      return;
    }

    const dialogRef = this.dialog.open(AddEditPlanDialogComponent, {
      width: '450px',
      data: {
        isEditMode: true,
        id: plan.id,
        name: plan.name,
        description: plan.description
      },
      disableClose: true,
    });

    dialogRef.afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(result => {
        if (result) {
          if (result.save && result.value) {
            this.loadingSignal.set(true);
            this.planService.updatePlan(plan.id, result.value)
              .pipe(
                finalize(() => this.loadingSignal.set(false)),
                takeUntilDestroyed(this.destroyRef)
              )
              .subscribe({
                next: (response) => {
                  if (response.data) {
                    this.getPlan(plan.id);
                    this.snackBar.open('Plan details updated.', 'OK', { duration: 3000 });
                  } else {
                    let errorMessage = 'Failed to update plan details.';
                    if (response.error) {
                      errorMessage = response.error || 'Unknown error while updating plan.';
                    }
                    this.snackBar.open(errorMessage, 'Close', { duration: 3000 });
                  }
                },
                error: (err: Error) => {
                  this.snackBar.open(err.message || 'A critical error occurred while saving plan details.', 'Close', { duration: 3000 });
                }
              });
          } else if (result.delete) {
            this.deletePlan();
          }
        }
      });
  }

  deletePlan = () => {
    const plan = this.planSignal();

    if (!plan || !plan.id) {
      this.snackBar.open('Plan is not available for deletion.', 'Close', { duration: 3000 });
      return;
    }

    this.loadingSignal.set(true);
    this.planService.deletePlan(plan.id)
      .pipe(
        finalize(() => this.loadingSignal.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response: PlanServiceResponse<null>) => {
          if (response.error) {
            const errorMessage = response.error || 'Failed to delete plan.';
            this.snackBar.open(errorMessage, 'Close', { duration: 5000 });
          } else {
            this.snackBar.open(`Plan "${plan.name ?? 'without name'}" has been deleted.`, 'OK', { duration: 3000 });
            this.router.navigate(['/plans']);
          }
        },
        error: (err: Error) => {
          this.snackBar.open(err.message || 'A critical error occurred while deleting the plan.', 'Close', { duration: 5000 });
        }
      });
  }

  togglePreview = () => {
    this.previewSignal.update(v => !v);

    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  addDay = () => {
    const planId = this.planSignal()?.id;
    if (!planId) {
      this.snackBar.open('No plan ID. Cannot add day.', 'Close', { duration: 3000 });
      return;
    }
    const dialogRef = this.dialog.open<AddEditDayDialogComponent, AddEditDayDialogData, AddEditDayDialogCloseResult>(
      AddEditDayDialogComponent,
      {
        width: '450px',
        data: { isEditMode: false },
        disableClose: true,
      });
    dialogRef.afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(result => {
        if (result && ('save' in result) && result.value) {
          this.loadingSignal.set(true);
          this.planService.createTrainingDay(planId, {
            name: result.value.name,
            description: result.value.description ?? '',
            order_index: (this.daysSignal().length + 1)
          })
            .pipe(finalize(() => this.loadingSignal.set(false)), takeUntilDestroyed(this.destroyRef))
            .subscribe({
              next: (response) => {
                if (response.data) {
                  this.snackBar.open('Day added.', 'OK', { duration: 2000 });
                  this.getPlan(planId);
                } else {
                  this.snackBar.open('Failed to add day: ' + (response.error || 'Unknown error'), 'Close', { duration: 4000 });
                }
              },
              error: (err) => {
                this.snackBar.open('Error while adding day: ' + (err.message || 'Unknown error'), 'Close', { duration: 4000 });
              }
            });
        }
      });
  };

  editDay = (dayId: string) => {
    const planId = this.planSignal()?.id;
    if (!planId) {
      this.snackBar.open('No plan ID. Cannot edit day.', 'Close', { duration: 3000 });
      return;
    }
    const day = this.daysSignal().find(d => d.id === dayId);
    if (!day) {
      this.snackBar.open('Day to edit not found.', 'Close', { duration: 3000 });
      return;
    }
    const dialogRef = this.dialog.open<AddEditDayDialogComponent, AddEditDayDialogData, AddEditDayDialogCloseResult>(
      AddEditDayDialogComponent,
      {
        width: '450px',
        data: { isEditMode: true, name: day.name, description: day.description },
        disableClose: true,
      });
    dialogRef.afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(result => {
        if (result && ('save' in result) && result.value) {
          this.loadingSignal.set(true);
          this.planService.updatePlanDay(planId, dayId, { name: result.value.name, description: result.value.description ?? '', order_index: day.order_index })
            .pipe(finalize(() => this.loadingSignal.set(false)), takeUntilDestroyed(this.destroyRef))
            .subscribe({
              next: (response) => {
                if (response.data) {
                  this.snackBar.open('Day updated.', 'OK', { duration: 2000 });
                  this.getPlan(planId);
                } else {
                  this.snackBar.open('Failed to update day: ' + (response.error || 'Unknown error'), 'Close', { duration: 4000 });
                }
              },
              error: (err) => {
                this.snackBar.open('Error while editing day: ' + (err.message || 'Unknown error'), 'Close', { duration: 4000 });
              }
            });
        } else if (result && ('delete' in result)) {
          this.deleteDay(dayId);
        }
      });
  };

  deleteDay = (dayId: string) => {
    const planId = this.planSignal()?.id;
    if (!planId) {
      this.snackBar.open('No plan ID. Cannot delete day.', 'Close', { duration: 3000 });
      return;
    }
    const day = this.daysSignal().find(d => d.id === dayId);
    if (!day) {
      this.snackBar.open('Day to delete not found.', 'Close', { duration: 3000 });
      return;
    }
    this.loadingSignal.set(true);
    this.planService.deletePlanDay(planId, dayId)
      .pipe(finalize(() => this.loadingSignal.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          if (!response.error) {
            this.snackBar.open('Day deleted.', 'OK', { duration: 2000 });
            this.getPlan(planId);
          } else {
            this.snackBar.open('Failed to delete day: ' + (response.error || 'Unknown error'), 'Close', { duration: 4000 });
          }
        },
        error: (err) => {
          this.snackBar.open('Error while deleting day: ' + (err.message || 'Unknown error'), 'Close', { duration: 4000 });
        }
      });
  };

  reorderDay = (dayId: string, index: number) => {
    const planId = this.planSignal()?.id;
    if (!planId) {
      this.snackBar.open('No plan ID. Cannot reorder day.', 'Close', { duration: 3000 });
      return;
    }
    const day = this.daysSignal().find(d => d.id === dayId);
    if (!day) {
      this.snackBar.open('Day to reorder not found.', 'Close', { duration: 3000 });
      return;
    }
    this.loadingSignal.set(true);
    this.planService.updatePlanDay(planId, dayId, { name: day.name, description: day.description, order_index: index })
      .pipe(finalize(() => this.loadingSignal.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          if (response.data) {
            this.snackBar.open('Day order updated.', 'OK', { duration: 2000 });
            this.getPlan(planId);
          } else {
            this.snackBar.open('Failed to update day order: ' + (response.error || 'Unknown error'), 'Close', { duration: 4000 });
          }
        },
        error: (err) => {
          this.snackBar.open('Error while reordering day: ' + (err.message || 'Unknown error'), 'Close', { duration: 4000 });
        }
      });
  };

  addExercise = (dayId: string) => {
    const planId = this.planSignal()?.id;
    if (!planId) {
      this.snackBar.open('No plan ID. Cannot add exercise.', 'Close', { duration: 3000 });
      return;
    }
    const day = this.daysSignal().find(d => d.id === dayId);
    if (!day) {
      this.snackBar.open('Day to add exercise not found.', 'Close', { duration: 3000 });
      return;
    }

    const addExerciseToBackend = (planId: string, dayId: string, exerciseId: string) => {
      this.loadingSignal.set(true);
      this.planService.addExerciseToPlanDay(planId, dayId, {
        exercise_id: exerciseId,
        order_index: (this.daysSignal().find(d => d.id === dayId)?.exercises?.length ?? 0) + 1
      })
        .pipe(finalize(() => this.loadingSignal.set(false)), takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (response) => {
            if (response.data) {
              this.snackBar.open('Exercise added.', 'OK', { duration: 2000 });
              this.getPlan(planId);
            } else {
              this.snackBar.open('Failed to add exercise: ' + (response?.error || 'Unknown error'), 'Close', { duration: 4000 });
            }
          },
          error: () => {
            this.snackBar.open('Error while adding exercise: Unknown error', 'Close', { duration: 4000 });
          }
        });
    }

    this.loadingSignal.set(true);
    const exercises = this.exerciseService.getAll();
    this.loadingSignal.set(false);

    const dialogRef = this.dialog.open<AddExerciseDialogComponent, AddExerciseDialogData, AddExerciseDialogCloseResult>(
      AddExerciseDialogComponent,
      {
        width: '450px',
        data: { exercises },
        disableClose: true,
      }
    );
    dialogRef.afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(result => {
        if (!result) return;
        let exerciseId: string | undefined;
        if ('saveExisting' in result && result.saveExisting) {
          exerciseId = result.value.id;
          addExerciseToBackend(planId, dayId, exerciseId);
        } else if ('saveNew' in result && result.saveNew) {
          this.loadingSignal.set(true);
          this.exerciseService.createExercise({
            name: result.value.name,
            description: result.value.description ?? null
          }).subscribe({
            next: (createRes) => {
              if (createRes?.data?.id) {
                exerciseId = createRes.data.id;
                addExerciseToBackend(planId, dayId, exerciseId);
              } else {
                this.snackBar.open('Failed to create new exercise.', 'Close', { duration: 4000 });
              }
              this.loadingSignal.set(false);
            },
            error: () => {
              this.snackBar.open('Error creating exercise.', 'Close', { duration: 4000 });
              this.loadingSignal.set(false);
            }
          });
        }
      });
  };

  deleteExercise = (exerciseId: string, dayId: string) => {
    const planId = this.planSignal()?.id;
    if (!planId) {
      this.snackBar.open('No plan ID. Cannot delete exercise.', 'Close', { duration: 3000 });
      return;
    }
    const day = this.daysSignal().find(d => d.id === dayId);
    const exercise = day?.exercises?.find(e => e.id === exerciseId);
    if (!exercise) {
      this.snackBar.open('Exercise to delete not found.', 'Close', { duration: 3000 });
      return;
    }
    const exerciseName = this.exerciseService.find(exercise.exercise_id)?.name;
    const dialogRef = this.dialog.open<ConfirmationDialogComponent, ConfirmationDialogData, boolean>(
      ConfirmationDialogComponent,
      {
        width: '400px',
        data: {
          title: 'Delete Exercise',
          message: `Are you sure you want to delete the exercise "${exerciseName ?? 'this exercise'}" from your training day? This action cannot be undone.`,
          confirmButtonText: 'Delete',
          cancelButtonText: 'Cancel',
        }
      }
    );
    dialogRef.afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(confirmed => {
        if (!confirmed) return;
        this.loadingSignal.set(true);
        this.planService.deletePlanExercise(planId!, dayId, exerciseId)
          .pipe(finalize(() => this.loadingSignal.set(false)), takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: (response) => {
              if (!response.error) {
                this.snackBar.open('Exercise deleted.', 'OK', { duration: 2000 });
                this.getPlan(planId!);
              } else {
                this.snackBar.open('Failed to delete exercise: ' + (response.error || 'Unknown error'), 'Close', { duration: 4000 });
              }
            },
            error: (err) => {
              this.snackBar.open('Error while deleting exercise: ' + (err.message || 'Unknown error'), 'Close', { duration: 4000 });
            }
          });
      });
  };

  reorderExercise = (exerciseId: string, dayId: string, index: number) => {
    const planId = this.planSignal()?.id;
    if (!planId) {
      this.snackBar.open('No plan ID. Cannot reorder exercise.', 'Close', { duration: 3000 });
      return;
    }
    const day = this.daysSignal().find(d => d.id === dayId);
    const exercise = day?.exercises?.find(e => e.id === exerciseId);
    if (!exercise) {
      this.snackBar.open('Exercise to reorder not found.', 'Close', { duration: 3000 });
      return;
    }
    this.loadingSignal.set(true);
    this.planService.updatePlanExercise(planId, dayId, exerciseId, { order_index: index })
      .pipe(finalize(() => this.loadingSignal.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          if (response.data) {
            this.snackBar.open('Exercise order updated.', 'OK', { duration: 2000 });
            this.getPlan(planId);
          } else {
            this.snackBar.open('Failed to update exercise order: ' + (response.error || 'Unknown error'), 'Close', { duration: 4000 });
          }
        },
        error: (err) => {
          this.snackBar.open('Error while reordering exercise: ' + (err.message || 'Unknown error'), 'Close', { duration: 4000 });
        }
      });
  };

  editProgression = (exerciseId: string) => {
    const planId = this.planSignal()?.id;
    if (!planId) {
      this.snackBar.open('No plan ID. Cannot edit exercise progression.', 'Close', { duration: 3000 });
      return;
    }
    const exercise = this.exerciseService.find(exerciseId);
    if (!exercise) {
      this.snackBar.open('Exercise to edit progression not found.', 'Close', { duration: 3000 });
      return;
    }
    this.loadingSignal.set(true);
    this.planService.getExerciseProgression(planId, exerciseId)
      .pipe(finalize(() => this.loadingSignal.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          const progression = response.data;
          const dialogRef = this.dialog.open<EditExerciseProgressionDialogComponent, EditExerciseProgressionDialogData, EditExerciseProgressionDialogCloseResult>(
            EditExerciseProgressionDialogComponent,
            {
              width: '450px',
              data: progression ?? {},
              disableClose: true,
            }
          );
          dialogRef.afterClosed()
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe(result => {
              if (result && result.save && result.value) {
                this.loadingSignal.set(true);
                this.planService.updateExerciseProgression(planId, exerciseId, result.value)
                  .pipe(finalize(() => this.loadingSignal.set(false)), takeUntilDestroyed(this.destroyRef))
                  .subscribe({
                    next: () => {
                      this.snackBar.open('Exercise progression updated.', 'OK', { duration: 2000 });
                      this.getPlan(planId);
                    },
                    error: (err) => {
                      this.snackBar.open('Error while editing progression: ' + (err.message || 'Unknown error'), 'Close', { duration: 4000 });
                    }
                  });
              }
            });
        },
        error: (err) => {
          this.snackBar.open('Error while fetching progression: ' + (err.message || 'Unknown error'), 'Close', { duration: 4000 });
        }
      });
  };

  addSet = (exerciseId: string, dayId: string) => {
    const planId = this.planSignal()?.id;
    if (!planId) {
      this.snackBar.open('No plan ID. Cannot add set.', 'Close', { duration: 3000 });
      return;
    }

    const day = this.daysSignal().find(d => d.id === dayId);
    const exercise = day?.exercises?.find(e => e.id === exerciseId);
    if (!exercise) {
      this.snackBar.open('Exercise to add set not found.', 'Close', { duration: 3000 });
      return;
    }

    const addSetToBackend = (expected_reps: number, expected_weight: number) => {
      this.loadingSignal.set(true);
      this.planService.addSetToPlanExercise(planId, dayId, exerciseId, {
        expected_reps,
        expected_weight,
        set_index: index
      })
        .pipe(finalize(() => this.loadingSignal.set(false)), takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (response) => {
            if (response.data) {
              this.snackBar.open('Set added.', 'OK', { duration: 2000 });
              this.getPlan(planId);
            } else {
              this.snackBar.open('Failed to add set' + (response.error ? ': ' + response.error : ''), 'Close', { duration: 4000 });
            }
          },
          error: (err) => {
            this.snackBar.open('Failed to add set' + (err.message ? ': ' + err.message : ''), 'Close', { duration: 4000 });
          }
        });
    };

    const sets = exercise.sets ?? [];
    const index = sets.length + 1;

    if (sets.length > 0) {
      const lastSet = sets[sets.length - 1];
      addSetToBackend(lastSet.expected_reps, lastSet.expected_weight);
    } else {
        const dialogRef = this.dialog.open<AddEditSetDialogComponent, AddEditSetDialogData, AddEditSetDialogCloseResult>(
          AddEditSetDialogComponent,
          {
            width: '450px',
            data: { isEditMode: false },
            disableClose: true,
          }
        );
      dialogRef.afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(result => {
        if (result && 'save' in result && result.value) {
          addSetToBackend(result.value.expected_reps, result.value.expected_weight);
        }
      });
    }
  };

  editSet = (setId: string, exerciseId: string, dayId: string) => {
    const planId = this.planSignal()?.id;
    if (!planId) {
      this.snackBar.open('No plan ID. Cannot edit set.', 'Close', { duration: 3000 });
      return;
    }
    const day = this.daysSignal().find(d => d.id === dayId);
    const exercise = day?.exercises?.find(e => e.id === exerciseId);
    const set = exercise?.sets?.find(s => s.id === setId);
    if (!set) {
      this.snackBar.open('Set to edit not found.', 'Close', { duration: 3000 });
      return;
    }
    const dialogRef = this.dialog.open<AddEditSetDialogComponent, AddEditSetDialogData, AddEditSetDialogCloseResult>(
      AddEditSetDialogComponent,
      {
        width: '450px',
        data: { isEditMode: true, expected_reps: set.expected_reps, expected_weight: set.expected_weight },
        disableClose: true,
      }
    );
    dialogRef.afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(result => {
        if (result && 'save' in result && result.value) {
          this.loadingSignal.set(true);
          this.planService.updatePlanExerciseSet(planId, dayId, exerciseId, setId, {
            expected_reps: result.value.expected_reps,
            expected_weight: result.value.expected_weight,
            set_index: set.set_index
          })
            .pipe(finalize(() => this.loadingSignal.set(false)), takeUntilDestroyed(this.destroyRef))
            .subscribe({
              next: (response) => {
                if (response.data) {
                  this.snackBar.open('Set updated.', 'OK', { duration: 2000 });
                  this.getPlan(planId);
                } else {
                  this.snackBar.open('Failed to update set: ' + (response.error || 'Unknown error'), 'Close', { duration: 4000 });
                }
              },
              error: (err) => {
                this.snackBar.open('Error while editing set: ' + (err.message || 'Unknown error'), 'Close', { duration: 4000 });
              }
            });
        } else if (result && 'delete' in result) {
          this.deleteSet(setId, exerciseId, dayId);
        }
      });
  };

  deleteSet = (setId: string, exerciseId: string, dayId: string) => {
    const planId = this.planSignal()?.id;
    if (!planId) {
      this.snackBar.open('No plan ID. Cannot delete set.', 'Close', { duration: 3000 });
      return;
    }
    const day = this.daysSignal().find(d => d.id === dayId);
    const exercise = day?.exercises?.find(e => e.id === exerciseId);
    const set = exercise?.sets?.find(s => s.id === setId);
    if (!set) {
      this.snackBar.open('Set to delete not found.', 'Close', { duration: 3000 });
      return;
    }
    this.loadingSignal.set(true);
    this.planService.deleteSetFromPlanExercise(planId, dayId, exerciseId, setId)
      .pipe(finalize(() => this.loadingSignal.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          if (!response.error) {
            this.snackBar.open('Set deleted.', 'OK', { duration: 2000 });
            this.getPlan(planId);
          } else {
            this.snackBar.open('Failed to delete set: ' + (response.error || 'Unknown error'), 'Close', { duration: 4000 });
          }
        },
        error: (err) => {
          this.snackBar.open('Error while deleting set: ' + (err.message || 'Unknown error'), 'Close', { duration: 4000 });
        }
      });
  };

  reorderSet = (setId: string, exerciseId: string, dayId: string, index: number) => {
    const planId = this.planSignal()?.id;
    if (!planId) {
      this.snackBar.open('No plan ID. Cannot reorder set.', 'Close', { duration: 3000 });
      return;
    }
    const day = this.daysSignal().find(d => d.id === dayId);
    const exercise = day?.exercises?.find(e => e.id === exerciseId);
    const set = exercise?.sets?.find(s => s.id === setId);
    if (!set) {
      this.snackBar.open('Set to reorder not found.', 'Close', { duration: 3000 });
      return;
    }
    this.loadingSignal.set(true);
    this.planService.updatePlanExerciseSet(planId, dayId, exerciseId, setId, { set_index: index })
      .pipe(finalize(() => this.loadingSignal.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          if (response.data) {
            this.snackBar.open('Set order updated.', 'OK', { duration: 2000 });
            this.getPlan(planId);
          } else {
            this.snackBar.open('Failed to update set order: ' + (response.error || 'Unknown error'), 'Close', { duration: 4000 });
          }
        },
        error: (err) => {
          this.snackBar.open('Error while reordering set: ' + (err.message || 'Unknown error'), 'Close', { duration: 4000 });
        }
      });
  };
}
