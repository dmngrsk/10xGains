import { DragDropModule } from '@angular/cdk/drag-drop';
import { CommonModule } from '@angular/common';
import { Component, Input, ChangeDetectionStrategy, Output, EventEmitter } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { PlanEditCapabilities } from '../../../../models/plan-edit-capabilities';
import { PlanExerciseProgressionViewModel, PlanExerciseViewModel } from '../../../../models/plan.viewmodel';
import { PlanExerciseSetListComponent } from '../plan-exercise-set-list/plan-exercise-set-list.component';

@Component({
  selector: 'txg-plan-exercise-item',
  templateUrl: './plan-exercise-item.component.html',
  styleUrl: './plan-exercise-item.component.scss',
  standalone: true,
  imports: [
    CommonModule,
    PlanExerciseSetListComponent,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatMenuModule,
    DragDropModule
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlanExerciseItemComponent {
  @Input({ required: true }) planId!: string;
  @Input({ required: true }) dayId!: string;
  @Input({ required: true }) exercise!: PlanExerciseViewModel;
  @Input({ required: true }) progression!: PlanExerciseProgressionViewModel | null;
  @Input({ required: true }) capabilities!: PlanEditCapabilities;

  @Output() exerciseDeleted = new EventEmitter<{exerciseId: string, exerciseName: string, dayId: string}>();
  @Output() exerciseArchived = new EventEmitter<{exerciseId: string, exerciseName: string, dayId: string}>();
  @Output() progressionEdited = new EventEmitter<{exerciseId: string}>();
  @Output() setAdded = new EventEmitter<{exerciseId: string, dayId: string}>();
  @Output() setEdited = new EventEmitter<{setId: string, exerciseId: string, dayId: string}>();
  @Output() setWeightStepped = new EventEmitter<{setId: string, exerciseId: string, dayId: string, weight: number}>();

  get hasMenuActions(): boolean {
    return this.capabilities.canEditPlanMetadata
      || this.capabilities.canDeleteStructure
      || this.capabilities.canArchiveStructure;
  }

  onProgressionEdited = () => this.progressionEdited.emit({ exerciseId: this.exercise.exerciseId });
  onExerciseDeleted = () => this.exerciseDeleted.emit({ exerciseId: this.exercise.id, exerciseName: this.exercise.exerciseName, dayId: this.dayId });
  onExerciseArchived = () => this.exerciseArchived.emit({ exerciseId: this.exercise.id, exerciseName: this.exercise.exerciseName, dayId: this.dayId });
  onSetAdded = () => this.setAdded.emit({ exerciseId: this.exercise.id, dayId: this.dayId });
  onSetEdited = (eventData: {setId: string, exerciseId: string, dayId: string}) => this.setEdited.emit(eventData);
  onSetWeightStepped = (eventData: {setId: string, exerciseId: string, dayId: string, weight: number}) => this.setWeightStepped.emit(eventData);
}
