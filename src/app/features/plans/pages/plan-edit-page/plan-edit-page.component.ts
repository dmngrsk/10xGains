import { CommonModule } from '@angular/common';
import { Component, DestroyRef, computed, inject, OnInit, ViewChild, ElementRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router, ActivatedRoute } from '@angular/router';
import { filter, Observable, of, switchMap, map, EMPTY } from 'rxjs';
import {
  UpdatePlanDayCommand,
  CreatePlanExerciseSetCommand,
  UpdatePlanExerciseSetCommand,
  UpdatePlanExerciseCommand,
  CreatePlanDayCommand,
  UpdatePlanCommand,
  CreatePlanExerciseCommand,
  CreateExerciseCommand,
} from '@shared/api/api.types';
import { NoticeComponent } from '@shared/ui/components/notice/notice.component';
import { ConfirmationDialogComponent, ConfirmationDialogData } from '@shared/ui/dialogs/confirmation-dialog/confirmation-dialog.component';
import { MainLayoutComponent } from '@shared/ui/layouts/main-layout/main-layout.component';
import { catchAndDisplayError } from '@shared/utils/operators/catch-display-error.operator';
import { tapIf } from '@shared/utils/operators/tap-if.operator';
import { PlanDayListComponent } from './components/plan-day-list/plan-day-list.component';
import { PlanMetadataComponent } from './components/plan-metadata/plan-metadata.component';
import { PlanEditPageFacade } from './plan-edit-page.facade';
import { AddEditDayDialogCloseResult, AddEditDayDialogComponent, AddEditDayDialogData, AddEditDayDialogValue } from '../../components/dialogs/add-edit-day/add-edit-day-dialog.component';
import { AddEditPlanDialogComponent, AddEditPlanDialogData, AddEditPlanDialogCloseResult } from '../../components/dialogs/add-edit-plan/add-edit-plan-dialog.component';
import { AddEditSetDialogComponent, AddEditSetDialogData, AddEditSetDialogCloseResult } from '../../components/dialogs/add-edit-set/add-edit-set-dialog.component';
import { AddExerciseDialogComponent, AddExerciseDialogCloseResult } from '../../components/dialogs/add-exercise/add-exercise-dialog.component';
import { EditExerciseProgressionDialogComponent, EditExerciseProgressionDialogData, EditExerciseProgressionDialogCloseResult } from '../../components/dialogs/edit-exercise-progression/edit-exercise-progression-dialog.component';
import { PlanDayViewModel, PlanExerciseViewModel, PlanExerciseSetViewModel, PlanExerciseProgressionViewModel } from '../../models/plan.viewmodel';

@Component({
  selector: 'txg-plan-edit-page',
  templateUrl: './plan-edit-page.component.html',
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
    NoticeComponent
  ],
})
export class PlanEditPageComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialog = inject(MatDialog);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  private readonly facade = inject(PlanEditPageFacade);

  readonly viewModel = this.facade.viewModel;
  readonly isLoadingSignal = computed(() => this.viewModel().isLoading);
  readonly isReadOnlySignal = computed(() => this.viewModel().isPreview || this.viewModel().sessionCount > 0);
  readonly canActivatePlanSignal = computed(() =>
    this.viewModel().plan
      && !this.viewModel().plan!.isActive
      && this.viewModel().plan!.days!.length > 0
      && this.viewModel().plan!.days!.flatMap(d => d.exercises).length > 0
      && this.viewModel().plan!.days!.flatMap(d => d.exercises!).flatMap(e => e.sets).length > 0);

  @ViewChild('mainScrollContainer') mainScrollContainer!: ElementRef;

  ngOnInit(): void {
    this.route.paramMap.pipe(
      takeUntilDestroyed(this.destroyRef),
      catchAndDisplayError('Failed to load plan', this.snackBar),
      switchMap(params => {
        this.facade.loadPlanData(params.get('planId'));
        return EMPTY;
      })
    ).subscribe();
  }

  onPlanEdited(): void {
    const viewModel = this.facade.viewModel();

    if (!viewModel || !viewModel.plan!.id) {
      this.snackBar.open('Plan data is not available for editing.', 'Close', { duration: 3000 });
      return;
    }

    const dialogData: AddEditPlanDialogData = {
      isEditMode: true,
      name: viewModel.plan!.name,
      description: viewModel.plan!.description
    };

    this.dialog
      .open(AddEditPlanDialogComponent, { width: '450px', data: dialogData, disableClose: true })
      .afterClosed()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        filter(result => this.isUpdatePlanDialogResult(result) || this.isDeletePlanDialogResult(result)),
        switchMap(result => {
          if (this.isUpdatePlanDialogResult(result)) {
            const command: UpdatePlanCommand = result.value;
            return this.facade.updatePlan(command).pipe(
              tapIf(success => !!success, () => this.snackBar.open('Plan details updated.', 'Close', { duration: 3000 })),
              tapIf(success => !success && viewModel.error, (response) => {
                const errorMessage = response.error || 'Failed to update plan.';
                this.snackBar.open(errorMessage, 'Close', { duration: 3000 });
              })
            );
          } else if (this.isDeletePlanDialogResult(result)) {
            this.onPlanDeleted();
            return EMPTY;
          }
          return EMPTY;
        }),
        catchAndDisplayError('Failed to update plan', this.snackBar),
      ).subscribe();
  }

  onPlanDeleted(): void {
    const plan = this.facade.viewModel().plan;

    if (!plan || !plan.id) {
      this.snackBar.open('Plan is not available for deletion.', 'Close', { duration: 3000 });
      return;
    }

    this.facade.deletePlan()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        tapIf(response => !response.error, () => {
          this.snackBar.open(`Plan "${plan.name}" has been deleted.`, 'Close', { duration: 3000 });
          this.router.navigate(['/plans']);
        }),
        tapIf(response => !!response.error, response => this.snackBar.open(response.error || 'Failed to delete plan.', 'Close', { duration: 5000 })),
        catchAndDisplayError('Failed to delete plan', this.snackBar)
      ).subscribe();
  }

  onPlanActivated(): void {
    const plan = this.facade.viewModel().plan;
    if (!plan || !plan.id) {
      this.snackBar.open('Plan is not available for activation.', 'Close', { duration: 3000 });
      return;
    }

    this.facade.activatePlan(plan.id)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        tapIf(response => !response.error, () => {
          this.snackBar.open('Plan activated.', 'Close', { duration: 3000 });
          this.router.navigate(['/home']);
        }),
        tapIf(response => !!response.error, response => this.snackBar.open(response.error || 'Failed to activate plan.', 'Close', { duration: 5000 })),
      ).subscribe();
  }

  onDayAdded(): void {
    const planId = this.facade.viewModel().plan?.id;

    if (!planId) {
      this.snackBar.open('No plan ID. Cannot add day.', 'Close', { duration: 3000 });
      return;
    }

    this.dialog
      .open(AddEditDayDialogComponent, { width: '450px', data: { isEditMode: false }, disableClose: true })
      .afterClosed()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        filter(result => this.isCreateDayDialogResult(result)),
        switchMap(result => {
          const resultValue = result.value as AddEditDayDialogValue;
          const command: CreatePlanDayCommand = {
            name: resultValue.name,
            description: resultValue.description ?? '',
            order_index: ((this.viewModel().plan?.days ?? []).length + 1)
          };
          return this.facade.createPlanDay(command);
        }),
        tapIf(response => !!response?.data, () => this.snackBar.open('Day added.', 'Close', { duration: 2000 })),
        tapIf(response => !response?.data, (response) => this.snackBar.open(response?.error || 'Failed to add day.', 'Close', { duration: 4000 })),
        catchAndDisplayError('Failed to add day', this.snackBar),
      ).subscribe();
  }

  onDayEdited(eventData: {dayId: string}): void {
    const { dayId } = eventData;
    const day = (this.viewModel().plan?.days ?? []).find((d: PlanDayViewModel) => d.id === dayId);

    if (!day) {
      this.snackBar.open('Day to edit not found.', 'Close', { duration: 3000 });
      return;
    }

    const dialogData: AddEditDayDialogData = {
      isEditMode: true,
      name: day.name,
      description: day.description
    };

    this.dialog
      .open(AddEditDayDialogComponent, { width: '450px', data: dialogData, disableClose: true })
      .afterClosed()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        filter(result => this.isUpdateDayDialogResult(result) || this.isDeleteDayDialogResult(result)),
        switchMap(result => {
          if (this.isUpdateDayDialogResult(result)) {
            const command: UpdatePlanDayCommand = result.value;
            return this.facade.updatePlanDay(dayId, command).pipe(
              tapIf(success => !!success, () => this.snackBar.open('Day updated.', 'Close', { duration: 2000 })),
              tapIf(success => !success, (response) => {
                const errorMessage = response.error || 'Failed to update day.';
                this.snackBar.open(errorMessage, 'Close', { duration: 4000 });
              })
            );
          } else if (this.isDeleteDayDialogResult(result)) {
            this.onDayDeleted(eventData);
            return EMPTY;
          }
          return EMPTY;
        }),
        catchAndDisplayError('Failed to update day', this.snackBar),
      ).subscribe();
  }

  onDayDeleted(eventData: {dayId: string}): void {
    const { dayId } = eventData;
    const day = (this.viewModel().plan?.days ?? []).find((d: PlanDayViewModel) => d.id === dayId);

    if (!day) {
      this.snackBar.open('Day to delete not found.', 'Close', { duration: 3000 });
      return;
    }

    this.facade.deletePlanDay(dayId)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        tapIf(response => !response.error, () => this.snackBar.open('Day deleted.', 'Close', { duration: 2000 })),
        tapIf(response => !!response.error, response => this.snackBar.open(response.error || 'Failed to delete day.', 'Close', { duration: 4000 })),
        catchAndDisplayError('Failed to delete day', this.snackBar)
      ).subscribe();
  }

  onDayReordered(eventData: {dayId: string, newIndex: number}): void {
    const { dayId, newIndex } = eventData;
    const day = (this.viewModel().plan?.days ?? []).find((d: PlanDayViewModel) => d.id === dayId);

    if (!day) {
      this.snackBar.open('Day to reorder not found.', 'Close', { duration: 3000 });
      return;
    }

    const command: UpdatePlanDayCommand = {
      name: day.name,
      description: day.description,
      order_index: newIndex
    };

    this.facade.updatePlanDay(dayId, command)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        tapIf(response => !!response.data, () => this.snackBar.open('Day order updated.', 'Close', { duration: 2000 })),
        tapIf(response => !response.data, response => this.snackBar.open(response.error || 'Failed to update day order.', 'Close', { duration: 4000 })),
        catchAndDisplayError('Failed to reorder day', this.snackBar)
      ).subscribe();
  }

  onExerciseAdded(eventData: {dayId: string}): void {
    const { dayId } = eventData;
    const day = (this.viewModel().plan?.days ?? []).find((d: PlanDayViewModel) => d.id === dayId);

    if (!day) {
      this.snackBar.open('Day to add exercise not found.', 'Close', { duration: 3000 });
      return;
    }

    const exercises = this.facade.getAvailableExercises();

    let planCommand: CreatePlanExerciseCommand = {
      exercise_id: '', // Will be set after exercise is selected or created
      order_index: (this.viewModel().plan?.days?.find(d => d.id === dayId)?.exercises?.length ?? 0) + 1
    };

    this.dialog
      .open(AddExerciseDialogComponent, { width: '450px', data: { exercises }, disableClose: true })
      .afterClosed()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        filter(result => this.isAddExistingExerciseDialogResult(result) || this.isAddNewExerciseDialogResult(result)),
        switchMap(result => {
          if (this.isAddExistingExerciseDialogResult(result)) {
            planCommand = { ...planCommand, exercise_id: result.value.id };
            return this.facade.createPlanExercise(dayId, planCommand);
          } else if (this.isAddNewExerciseDialogResult(result)) {
            const exerciseCommand: CreateExerciseCommand = { name: result.value.name, description: result.value.description ?? null };
            return this.facade.createGlobalExerciseAndPlanExercise(dayId, exerciseCommand, planCommand);
          } else {
            return EMPTY;
          }
        }),
        tapIf(response => !!response?.data, response => {
          const exerciseId = response!.data!.exercise_id;
          const shouldOpenProgressionDialog = this.viewModel().plan?.progressions?.every(p => p.exerciseId !== exerciseId);
          if (shouldOpenProgressionDialog) {
            this.onProgressionEdited({ exerciseId });
          }
          this.snackBar.open('Exercise added.', 'Close', { duration: 2000 });
        }),
        tapIf(response => !response?.data, (response) => this.snackBar.open(response?.error || 'Failed to add exercise.', 'Close', { duration: 4000 })),
        catchAndDisplayError('Failed to add exercise', this.snackBar)
      ).subscribe();
  }

  onExerciseDeleted(eventData: {exerciseId: string, exerciseName: string, dayId: string}): void {
    const { exerciseId, exerciseName, dayId } = eventData;
    const day = (this.viewModel().plan?.days ?? []).find((d: PlanDayViewModel) => d.id === dayId);
    const exercise = day?.exercises?.find((e: PlanExerciseViewModel) => e.id === exerciseId);

    if (!exercise) {
      this.snackBar.open('Exercise to delete not found.', 'Close', { duration: 3000 });
      return;
    }

    const dialogData: ConfirmationDialogData = {
      title: 'Delete Exercise',
      message: `Are you sure you want to delete the exercise "${exerciseName}" from this training day? This action cannot be undone.`,
      confirmButtonText: 'Delete',
      cancelButtonText: 'Cancel',
    };

    this.dialog
      .open(ConfirmationDialogComponent, { width: '400px', data: dialogData })
      .afterClosed()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        filter(result => !!result),
        switchMap(() => this.facade.deletePlanExercise(dayId, exerciseId)),
        tapIf(response => !response?.error, () => this.snackBar.open('Exercise deleted.', 'Close', { duration: 2000 })),
        tapIf(response => !!response?.error, (response) => this.snackBar.open(response?.error || 'Failed to delete exercise.', 'Close', { duration: 4000 })),
        catchAndDisplayError('Failed to delete exercise', this.snackBar)
      ).subscribe();
  }

  onExerciseReordered(eventData: {exerciseId: string, dayId: string, newIndex: number}): void {
    const { exerciseId, dayId, newIndex } = eventData;
    const day = (this.viewModel().plan?.days ?? []).find((d: PlanDayViewModel) => d.id === dayId);
    const exercise = day?.exercises?.find((e: PlanExerciseViewModel) => e.id === exerciseId);

    if (!exercise) {
      this.snackBar.open('Exercise to reorder not found.', 'Close', { duration: 3000 });
      return;
    }

    const command: UpdatePlanExerciseCommand = { order_index: newIndex };
    this.facade.updatePlanExercise(dayId, exerciseId, command)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        tapIf(response => !!response.data, () => this.snackBar.open('Exercise order updated.', 'Close', { duration: 2000 })),
        tapIf(response => !response.data, response => this.snackBar.open(response.error || 'Failed to update exercise order.', 'Close', { duration: 4000 })),
        catchAndDisplayError('Failed to reorder exercise', this.snackBar)
      ).subscribe();
  }

  onProgressionEdited(eventData: {exerciseId: string}): void {
    const { exerciseId } = eventData;
    const progression = this.viewModel().plan?.progressions?.find((p: PlanExerciseProgressionViewModel) => p.exerciseId === exerciseId);

    const dialogData: EditExerciseProgressionDialogData = {
      weight_increment: progression?.weightIncrement ?? undefined,
      deload_strategy: progression?.deloadStrategy as 'PROPORTIONAL' | 'REFERENCE_SET' | 'CUSTOM' | undefined,
      reference_set_index: progression?.referenceSetIndex ?? undefined,
      failure_count_for_deload: progression?.failureCountForDeload ?? undefined,
      deload_percentage: progression?.deloadPercentage ?? undefined,
    };

    this.dialog
      .open(EditExerciseProgressionDialogComponent, { width: '450px', data: dialogData, disableClose: true })
      .afterClosed()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        filter(result => this.isSaveProgressionDialogResult(result)),
        switchMap(result => this.facade.upsertExerciseProgression(exerciseId, result.value)),
        tapIf(response => !!response?.data, () => this.snackBar.open('Exercise progression updated.', 'Close', { duration: 2000 })),
        tapIf(response => !response?.data, (response) => this.snackBar.open(response?.error || 'Failed to update exercise progression.', 'Close', { duration: 4000 })),
        catchAndDisplayError('Failed to update exercise progression', this.snackBar)
      ).subscribe();
  }

  onSetAdded(eventData: {exerciseId: string, dayId: string}): void {
    const { exerciseId, dayId } = eventData;
    const day = (this.viewModel().plan?.days ?? []).find((d: PlanDayViewModel) => d.id === dayId);
    const exercise = day?.exercises?.find((e: PlanExerciseViewModel) => e.id === exerciseId);

    if (!exercise) {
      this.snackBar.open('Exercise to add set not found.', 'Close', { duration: 3000 });
      return;
    }

    const sets = exercise.sets ?? [];
    const newSetIndex = sets.length + 1;

    let setValue$: Observable<{ expected_reps: number; expected_weight: number; } | null> = EMPTY;
    if (sets.length > 0) {
      const lastSet = sets[sets.length - 1];
      setValue$ = of({ expected_reps: lastSet.expectedReps!, expected_weight: lastSet.expectedWeight! });
    } else {
      setValue$ = this.dialog
        .open(AddEditSetDialogComponent, { width: '450px', data: { isEditMode: false }, disableClose: true })
        .afterClosed()
        .pipe(map(result => this.isSaveSetDialogResult(result)
          ? { expected_reps: result.value.expected_reps, expected_weight: result.value.expected_weight }
          : null));
    }

    setValue$.pipe(
      takeUntilDestroyed(this.destroyRef),
      filter(values => !!values),
      map(values => <CreatePlanExerciseSetCommand> {
        expected_reps: values!.expected_reps,
        expected_weight: values!.expected_weight,
        set_index: newSetIndex
      }),
      switchMap(command => this.facade.addPlanExerciseSet(dayId, exerciseId, command)),
      tapIf(response => !!response?.data, () => this.snackBar.open('Set added.', 'Close', { duration: 2000 })),
      tapIf(response => !response?.data, (response) => this.snackBar.open(response?.error || 'Failed to add set.', 'Close', { duration: 4000 })),
      catchAndDisplayError('Failed to add set', this.snackBar),
    ).subscribe();
  }

  onSetEdited(eventData: {setId: string, exerciseId: string, dayId: string}): void {
    const { setId, exerciseId, dayId } = eventData;
    const day = (this.viewModel().plan?.days ?? []).find((d: PlanDayViewModel) => d.id === dayId);
    const exercise = day?.exercises?.find((e: PlanExerciseViewModel) => e.id === exerciseId);
    const set = exercise?.sets?.find((s: PlanExerciseSetViewModel) => s.id === setId);

    if (!set) {
      this.snackBar.open('Set to edit not found.', 'Close', { duration: 3000 });
      return;
    }

    const dialogData: AddEditSetDialogData = {
      isEditMode: true,
      expected_reps: set.expectedReps ?? undefined,
      expected_weight: set.expectedWeight ?? undefined
    };

    this.dialog
      .open(AddEditSetDialogComponent, { width: '450px', data: dialogData, disableClose: true })
      .afterClosed()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        filter(result => this.isSaveSetDialogResult(result) || this.isDeleteSetDialogResult(result)),
        switchMap(result => {
          if (this.isSaveSetDialogResult(result)) {
            const command: UpdatePlanExerciseSetCommand = {
              expected_reps: result!.value!.expected_reps,
              expected_weight: result!.value!.expected_weight,
              set_index: set.setIndex
            };
            return this.facade.updatePlanExerciseSet(dayId, exerciseId, setId, command).pipe(
              tapIf(response => !!response?.data, () => this.snackBar.open('Set updated.', 'Close', { duration: 2000 })),
              tapIf(response => !response?.data, (response) => this.snackBar.open(response?.error || 'Failed to update set.', 'Close', { duration: 4000 })),
            );
          } else if (this.isDeleteSetDialogResult(result)) {
            this.onSetDeleted(eventData);
            return EMPTY;
          } else {
            return EMPTY;
          }
        }),
        catchAndDisplayError('Failed to update set', this.snackBar)
      ).subscribe();
  }

  onSetDeleted(eventData: {setId: string, exerciseId: string, dayId: string}): void {
    const { setId, exerciseId, dayId } = eventData;
    const day = (this.viewModel().plan?.days ?? []).find((d: PlanDayViewModel) => d.id === dayId);
    const exercise = day?.exercises?.find((e: PlanExerciseViewModel) => e.id === exerciseId);
    const set = exercise?.sets?.find((s: PlanExerciseSetViewModel) => s.id === setId);

    if (!set) {
      this.snackBar.open('Set to edit not found.', 'Close', { duration: 3000 });
      return;
    }

    this.facade.deletePlanExerciseSet(dayId, exerciseId, setId)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        tapIf(response => !response.error, () => this.snackBar.open('Set deleted.', 'Close', { duration: 2000 })),
        tapIf(response => !!response.error, response => this.snackBar.open(response.error || 'Failed to delete set.', 'Close', { duration: 4000 })),
        catchAndDisplayError('Failed to delete set', this.snackBar)
      ).subscribe();
  }

  onSetReordered(eventData: {setId: string, exerciseId: string, dayId: string, newIndex: number}): void {
    const { setId, exerciseId, dayId, newIndex } = eventData;
    const day = (this.viewModel().plan?.days ?? []).find((d: PlanDayViewModel) => d.id === dayId);
    const exercise = day?.exercises?.find((e: PlanExerciseViewModel) => e.id === exerciseId);
    const set = exercise?.sets?.find((s: PlanExerciseSetViewModel) => s.id === setId);

    if (!set) {
      this.snackBar.open('Set to edit not found.', 'Close', { duration: 3000 });
      return;
    }

    const command: UpdatePlanExerciseSetCommand = { set_index: newIndex };
    this.facade.updatePlanExerciseSet(dayId, exerciseId, setId, command)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        tapIf(response => !!response.data, () => this.snackBar.open('Set order updated.', 'Close', { duration: 2000 })),
        tapIf(response => !response.data, response => this.snackBar.open(response.error || 'Failed to update set order.', 'Close', { duration: 4000 })),
        catchAndDisplayError('Failed to reorder set', this.snackBar)
      ).subscribe();
  }

  onPlansNavigated() {
    this.router.navigate(['/plans']);
  }

  onPreviewToggled(): void {
    this.facade.togglePreviewMode();
    setTimeout(() => this.mainScrollContainer.nativeElement.scrollTo({ top: 0, behavior: 'smooth' }), 50);
  }

  private isUpdatePlanDialogResult(result: AddEditPlanDialogCloseResult): boolean {
    return (result && 'save' in result && result.save) ?? false;
  }

  private isDeletePlanDialogResult(result: AddEditPlanDialogCloseResult): boolean {
    return (result && 'delete' in result && result.delete) ?? false;
  }

  private isCreateDayDialogResult(result: AddEditDayDialogCloseResult): boolean {
    return (result && 'save' in result && result.save && !!result.value) ?? false;
  }

  private isUpdateDayDialogResult(result: AddEditDayDialogCloseResult): boolean {
    return (result && 'save' in result && result.save && !!result.value) ?? false;
  }

  private isDeleteDayDialogResult(result: AddEditDayDialogCloseResult): boolean {
    return (result && 'delete' in result && result.delete) ?? false;
  }

  private isAddExistingExerciseDialogResult(result: AddExerciseDialogCloseResult): boolean {
    return (result && 'saveExisting' in result && result.saveExisting && !!result.value?.id) ?? false;
  }

  private isAddNewExerciseDialogResult(result: AddExerciseDialogCloseResult): boolean {
    return (result && 'saveNew' in result && result.saveNew && !!result.value?.name) ?? false;
  }

  private isSaveProgressionDialogResult(result: EditExerciseProgressionDialogCloseResult): boolean {
    return (result && 'save' in result && result.save && !!result.value) ?? false;
  }

  private isSaveSetDialogResult(result: AddEditSetDialogCloseResult): boolean {
    return (result && 'save' in result && result.save && !!result.value) ?? false;
  }

  private isDeleteSetDialogResult(result: AddEditSetDialogCloseResult): boolean {
    return (result && 'delete' in result && result.delete) ?? false;
  }
}
