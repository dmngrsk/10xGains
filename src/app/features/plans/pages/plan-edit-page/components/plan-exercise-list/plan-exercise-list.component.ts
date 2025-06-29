import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input, Output, EventEmitter, signal, SimpleChanges, OnChanges } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { PlanExerciseProgressionViewModel, PlanExerciseViewModel } from '../../../../models/plan.viewmodel';
import { PlanExerciseItemComponent } from '../plan-exercise-item/plan-exercise-item.component';

@Component({
  selector: 'txg-plan-exercise-list',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatExpansionModule,
    PlanExerciseItemComponent,
    DragDropModule,
  ],
  templateUrl: './plan-exercise-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlanExerciseListComponent implements OnChanges {
  @Input({ required: true }) planId!: string;
  @Input({ required: true }) dayId!: string;
  @Input({ required: true }) exercises!: PlanExerciseViewModel[];
  @Input({ required: true }) progressions!: PlanExerciseProgressionViewModel[];
  @Input({ required: true }) isReadOnly!: boolean;

  @Output() exerciseDeleted = new EventEmitter<{exerciseId: string, exerciseName: string, dayId: string}>();
  @Output() exerciseReordered = new EventEmitter<{exerciseId: string, dayId: string, newIndex: number}>();
  @Output() progressionEdited = new EventEmitter<{exerciseId: string}>();
  @Output() setAdded = new EventEmitter<{exerciseId: string, dayId: string}>();
  @Output() setEdited = new EventEmitter<{setId: string, exerciseId: string, dayId: string}>();
  @Output() setDeleted = new EventEmitter<{setId: string, exerciseId: string, dayId: string}>();
  @Output() setReordered = new EventEmitter<{setId: string, exerciseId: string, dayId: string, newIndex: number}>();

  onExerciseDeleted = (eventData: {exerciseId: string, exerciseName: string, dayId: string}): void => this.exerciseDeleted.emit(eventData);
  onExerciseReordered = (event: CdkDragDrop<PlanExerciseViewModel[]>): void => this.onExerciseItemDropped(event);
  onProgressionEdited = (eventData: {exerciseId: string}): void => this.progressionEdited.emit(eventData);
  onSetAdded = (eventData: {exerciseId: string, dayId: string}): void => this.setAdded.emit(eventData);
  onSetEdited = (eventData: {setId: string, exerciseId: string, dayId: string}): void => this.setEdited.emit(eventData);
  onSetDeleted = (eventData: {setId: string, exerciseId: string, dayId: string}): void => this.setDeleted.emit(eventData);
  onSetReordered = (eventData: {setId: string, exerciseId: string, dayId: string, newIndex: number}): void => this.setReordered.emit(eventData);

  expandedStates = signal<boolean[]>([]);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isReadOnly']) {
      const isReadOnlyValue = changes['isReadOnly'].currentValue as boolean;
      if (isReadOnlyValue) {
        this.expandedStates.set(this.exercises.map(() => true));
      }
    }
  }

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

  onExerciseItemToggled(index: number, expanded: boolean) {
    const current = this.expandedStates();
    this.expandedStates.set(current.map((val, i) => (i === index ? expanded : val)));
  }
}
