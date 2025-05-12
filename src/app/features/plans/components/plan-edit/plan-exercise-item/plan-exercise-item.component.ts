import { Component, Input, ChangeDetectionStrategy, inject, Signal, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TrainingPlanExerciseDto } from '@shared/api/api.types';
import { PlanExerciseSetListComponent } from '../plan-exercise-set-list/plan-exercise-set-list.component';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ExerciseService } from '@shared/services/exercise.service';

@Component({
  selector: 'txg-plan-exercise-item',
  templateUrl: './plan-exercise-item.component.html',
  standalone: true,
  imports: [
    CommonModule,
    PlanExerciseSetListComponent,
    MatButtonModule,
    MatIconModule
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlanExerciseItemComponent {
  @Input({ required: true }) planId!: string;
  @Input({ required: true }) dayId!: string;
  @Input({ required: true }) exercise!: TrainingPlanExerciseDto;
  @Input() preview: Signal<boolean> = signal(false);
  @Input() onDeleteExercise!: (exerciseId: string, dayId: string) => void;
  @Input() onEditProgression!: (exerciseId: string) => void;
  @Input() onAddSet!: (exerciseId: string, dayId: string) => void;
  @Input() onEditSet!: (setId: string, exerciseId: string, dayId: string) => void;
  @Input() onDeleteSet!: (setId: string, exerciseId: string, dayId: string) => void;
  @Input() onReorderSet!: (setId: string, exerciseId: string, dayId: string, index: number) => void;

  onEditProgressionClick = () => this.onEditProgression(this.exercise.exercise_id);
  onDeleteExerciseClick = () => this.onDeleteExercise(this.exercise.id, this.dayId);

  exerciseService = inject(ExerciseService);
  getExerciseDescription = (exerciseId: string) => this.exerciseService.find(exerciseId)?.description;
}
