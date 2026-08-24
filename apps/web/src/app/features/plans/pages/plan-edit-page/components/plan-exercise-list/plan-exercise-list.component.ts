import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input, Output, EventEmitter } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { PlanEditCapabilities } from '../../../../models/plan-edit-capabilities';
import { PlanExerciseProgressionViewModel, PlanExerciseViewModel } from '../../../../models/plan.viewmodel';
import { PlanExerciseItemComponent } from '../plan-exercise-item/plan-exercise-item.component';

@Component({
  selector: 'txg-plan-exercise-list',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    PlanExerciseItemComponent,
    DragDropModule,
  ],
  templateUrl: './plan-exercise-list.component.html',
  styleUrl: './plan-exercise-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlanExerciseListComponent {
  @Input({ required: true }) planId!: string;
  @Input({ required: true }) dayId!: string;
  @Input({ required: true }) exercises!: PlanExerciseViewModel[];
  @Input({ required: true }) progressions!: PlanExerciseProgressionViewModel[];
  @Input({ required: true }) capabilities!: PlanEditCapabilities;

  @Output() exerciseAdded = new EventEmitter<{dayId: string}>();
  @Output() exerciseDeleted = new EventEmitter<{exerciseId: string, exerciseName: string, dayId: string}>();
  @Output() exerciseArchived = new EventEmitter<{exerciseId: string, exerciseName: string, dayId: string}>();
  @Output() exerciseReordered = new EventEmitter<{exerciseId: string, dayId: string, newIndex: number}>();
  @Output() progressionEdited = new EventEmitter<{exerciseId: string}>();
  @Output() setAdded = new EventEmitter<{exerciseId: string, dayId: string}>();
  @Output() setEdited = new EventEmitter<{setId: string, exerciseId: string, dayId: string}>();
  @Output() setWeightStepped = new EventEmitter<{setId: string, exerciseId: string, dayId: string, weight: number}>();

  onExerciseAdded = (): void => this.exerciseAdded.emit({ dayId: this.dayId });
  onExerciseArchived = (eventData: {exerciseId: string, exerciseName: string, dayId: string}): void => this.exerciseArchived.emit(eventData);
  onExerciseDeleted = (eventData: {exerciseId: string, exerciseName: string, dayId: string}): void => this.exerciseDeleted.emit(eventData);
  onExerciseReordered = (event: CdkDragDrop<PlanExerciseViewModel[]>): void => this.onExerciseItemDropped(event);
  onProgressionEdited = (eventData: {exerciseId: string}): void => this.progressionEdited.emit(eventData);
  onSetAdded = (eventData: {exerciseId: string, dayId: string}): void => this.setAdded.emit(eventData);
  onSetEdited = (eventData: {setId: string, exerciseId: string, dayId: string}): void => this.setEdited.emit(eventData);
  onSetWeightStepped = (eventData: {setId: string, exerciseId: string, dayId: string, weight: number}): void => this.setWeightStepped.emit(eventData);

  getProgression(exerciseId: string): PlanExerciseProgressionViewModel | null {
    return this.progressions?.find(p => p.exerciseId === exerciseId) ?? null;
  }

  onExerciseItemDropped(event: CdkDragDrop<PlanExerciseViewModel[]>): void {
    if (event.previousContainer === event.container && event.previousIndex !== event.currentIndex) {
      const movedExercise = this.exercises[event.previousIndex];
      this.exercises.splice(event.previousIndex, 1);
      this.exercises.splice(event.currentIndex, 0, movedExercise);
      this.exerciseReordered.emit({ exerciseId: movedExercise.id, dayId: this.dayId, newIndex: event.currentIndex + 1 });
    }
  }
}
