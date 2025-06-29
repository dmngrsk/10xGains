import { DragDropModule } from '@angular/cdk/drag-drop';
import { CommonModule } from '@angular/common';
import { Component, Input, ChangeDetectionStrategy, Output, EventEmitter } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { PlanExerciseProgressionViewModel, PlanExerciseViewModel } from '../../../../models/plan.viewmodel';
import { PlanExerciseSetListComponent } from '../plan-exercise-set-list/plan-exercise-set-list.component';

@Component({
  selector: 'txg-plan-exercise-item',
  templateUrl: './plan-exercise-item.component.html',
  styleUrls: ['./plan-exercise-item.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    PlanExerciseSetListComponent,
    MatButtonModule,
    MatIconModule,
    MatExpansionModule,
    DragDropModule
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlanExerciseItemComponent {
  @Input({ required: true }) planId!: string;
  @Input({ required: true }) dayId!: string;
  @Input({ required: true }) exercise!: PlanExerciseViewModel;
  @Input({ required: true }) progression!: PlanExerciseProgressionViewModel | null;
  @Input({ required: true }) isReadOnly!: boolean;
  @Input({ required: true }) expanded!: boolean;

  @Output() opened = new EventEmitter<void>();
  @Output() closed = new EventEmitter<void>();
  @Output() exerciseDeleted = new EventEmitter<{exerciseId: string, exerciseName: string, dayId: string}>();
  @Output() progressionEdited = new EventEmitter<{exerciseId: string}>();
  @Output() setAdded = new EventEmitter<{exerciseId: string, dayId: string}>();
  @Output() setEdited = new EventEmitter<{setId: string, exerciseId: string, dayId: string}>();
  @Output() setDeleted = new EventEmitter<{setId: string, exerciseId: string, dayId: string}>();
  @Output() setReordered = new EventEmitter<{setId: string, exerciseId: string, dayId: string, newIndex: number}>();

  onProgressionEdited = () => this.progressionEdited.emit({ exerciseId: this.exercise.exerciseId });
  onExerciseDeleted = () => this.exerciseDeleted.emit({ exerciseId: this.exercise.id, exerciseName: this.exercise.exerciseName, dayId: this.dayId });
  onSetAdded = () => this.setAdded.emit({ exerciseId: this.exercise.id, dayId: this.dayId });
  onSetEdited = (eventData: {setId: string, exerciseId: string, dayId: string}) => this.setEdited.emit(eventData);
  onSetDeleted = (eventData: {setId: string, exerciseId: string, dayId: string}) => this.setDeleted.emit(eventData);
  onSetReordered = (eventData: {setId: string, exerciseId: string, dayId: string, newIndex: number}) => this.setReordered.emit(eventData);
}
