import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input, Output, EventEmitter } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { PlanEditCapabilities } from '@features/plans/models/plan-edit-capabilities';
import { PlanExerciseSetViewModel } from '@features/plans/models/plan.viewmodel';
import { PlanExerciseSetItemComponent } from '../plan-exercise-set-item/plan-exercise-set-item.component';

/** An exercise's sets, as a table. Not reorderable: they differ only by reps and weight. */
@Component({
  selector: 'txg-plan-exercise-set-list',
  standalone: true,
  imports: [
    CommonModule,
    PlanExerciseSetItemComponent,
    MatButtonModule,
    MatIconModule,
  ],
  templateUrl: './plan-exercise-set-list.component.html',
  styleUrl: './plan-exercise-set-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlanExerciseSetListComponent {
  @Input({ required: true }) planId!: string;
  @Input({ required: true }) dayId!: string;
  @Input({ required: true }) exerciseId!: string;
  @Input({ required: true }) sets!: PlanExerciseSetViewModel[];
  @Input({ required: true }) capabilities!: PlanEditCapabilities;
  @Input() weightIncrement: number | null = null;

  @Output() setAdded = new EventEmitter<{exerciseId: string, dayId: string}>();
  @Output() setEdited = new EventEmitter<{setId: string, exerciseId: string, dayId: string}>();
  @Output() setWeightStepped = new EventEmitter<{setId: string, exerciseId: string, dayId: string, weight: number}>();

  onSetAdded = () => this.setAdded.emit({ exerciseId: this.exerciseId, dayId: this.dayId });
  onSetEdited = (eventData: {setId: string, exerciseId: string, dayId: string}) => this.setEdited.emit(eventData);
  onSetWeightStepped = (eventData: {setId: string, exerciseId: string, dayId: string, weight: number}) => this.setWeightStepped.emit(eventData);
}
