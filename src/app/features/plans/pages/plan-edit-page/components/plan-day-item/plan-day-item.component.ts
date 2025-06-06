import { DragDropModule } from '@angular/cdk/drag-drop';
import { CommonModule } from '@angular/common';
import { Component, Input, ChangeDetectionStrategy, Output, EventEmitter } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { TrainingPlanDayViewModel, TrainingPlanExerciseProgressionViewModel } from '../../../../models/training-plan.viewmodel';
import { PlanExerciseListComponent } from '../plan-exercise-list/plan-exercise-list.component';

@Component({
  selector: 'txg-plan-day-item',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatExpansionModule,
    MatIconModule,
    PlanExerciseListComponent,
    DragDropModule,
  ],
  templateUrl: './plan-day-item.component.html',
  styleUrls: ['./plan-day-item.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlanDayItemComponent {
  @Input({ required: true }) planId!: string;
  @Input({ required: true }) day!: TrainingPlanDayViewModel;
  @Input({ required: true }) progressions!: TrainingPlanExerciseProgressionViewModel[];
  @Input({ required: true }) isReadOnly!: boolean;
  @Input({ required: true }) expanded!: boolean;

  @Output() opened = new EventEmitter<void>();
  @Output() closed = new EventEmitter<void>();
  @Output() dayEdited = new EventEmitter<{dayId: string}>();
  @Output() exerciseAdded = new EventEmitter<{dayId: string}>();
  @Output() exerciseDeleted = new EventEmitter<{exerciseId: string, exerciseName: string, dayId: string}>();
  @Output() exerciseReordered = new EventEmitter<{exerciseId: string, dayId: string, newIndex: number}>();
  @Output() progressionEdited = new EventEmitter<{exerciseId: string}>();
  @Output() setAdded = new EventEmitter<{exerciseId: string, dayId: string}>();
  @Output() setEdited = new EventEmitter<{setId: string, exerciseId: string, dayId: string}>();
  @Output() setDeleted = new EventEmitter<{setId: string, exerciseId: string, dayId: string}>();
  @Output() setReordered = new EventEmitter<{setId: string, exerciseId: string, dayId: string, newIndex: number}>();

  onDayEdited = () => this.dayEdited.emit({ dayId: this.day.id });
  onExerciseAdded = (): void => this.exerciseAdded.emit({ dayId: this.day.id });
  onExerciseDeleted = (eventData: {exerciseId: string, exerciseName: string, dayId: string}) => this.exerciseDeleted.emit(eventData);
  onExerciseReordered = (eventData: {exerciseId: string, dayId: string, newIndex: number}) => this.exerciseReordered.emit(eventData);
  onProgressionEdited = (eventData: {exerciseId: string}) => this.progressionEdited.emit(eventData);
  onSetAdded = (eventData: {exerciseId: string, dayId: string}) => this.setAdded.emit(eventData);
  onSetEdited = (eventData: {setId: string, exerciseId: string, dayId: string}) => this.setEdited.emit(eventData);
  onSetDeleted = (eventData: {setId: string, exerciseId: string, dayId: string}) => this.setDeleted.emit(eventData);
  onSetReordered = (eventData: {setId: string, exerciseId: string, dayId: string, newIndex: number}) => this.setReordered.emit(eventData);
}
