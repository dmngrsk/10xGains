import { CdkDragHandle } from '@angular/cdk/drag-drop';
import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input, Output, EventEmitter } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { TrainingPlanExerciseSetViewModel } from '@features/plans/models/training-plan.viewmodel';

@Component({
  selector: 'txg-plan-exercise-set-item',
  standalone: true,
  imports: [
    CdkDragHandle,
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatCardModule,
  ],
  templateUrl: './plan-exercise-set-item.component.html',
  styleUrls: ['./plan-exercise-set-item.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlanExerciseSetItemComponent {
  @Input({ required: true }) planId!: string;
  @Input({ required: true }) dayId!: string;
  @Input({ required: true }) exerciseId!: string;
  @Input({ required: true }) set!: TrainingPlanExerciseSetViewModel;
  @Input({ required: true }) isReadOnly!: boolean;

  @Output() setEdited = new EventEmitter<{setId: string, exerciseId: string, dayId: string}>();
  @Output() setDeleted = new EventEmitter<{setId: string, exerciseId: string, dayId: string}>();

  onSetEdited = () => this.setEdited.emit({ setId: this.set.id, exerciseId: this.exerciseId, dayId: this.dayId });
  onSetDeleted = () => this.setDeleted.emit({ setId: this.set.id, exerciseId: this.exerciseId, dayId: this.dayId });
}
