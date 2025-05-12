import { ChangeDetectionStrategy, Component, Input, Signal, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { TrainingPlanExerciseSetDto } from '@shared/api/api.types';

@Component({
  selector: 'txg-plan-exercise-set-item',
  standalone: true,
  imports: [
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
  @Input({ required: true }) set!: TrainingPlanExerciseSetDto;
  @Input() preview: Signal<boolean> = signal(false);
  @Input() onEditSet!: (setId: string, exerciseId: string, dayId: string) => void;
  @Input() onDeleteSet!: (setId: string, exerciseId: string, dayId: string) => void;

  onEditSetClick = () => this.onEditSet(this.set.id, this.exerciseId, this.dayId);
}
