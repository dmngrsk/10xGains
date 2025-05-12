import { Component, Input, ChangeDetectionStrategy, Signal, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TrainingPlanDayDto } from '@shared/api/api.types';
import { PlanExerciseListComponent } from '../plan-exercise-list/plan-exercise-list.component';

@Component({
  selector: 'txg-plan-day-item',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    PlanExerciseListComponent
  ],
  templateUrl: './plan-day-item.component.html',
  styleUrls: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlanDayItemComponent {
  @Input({ required: true }) planId!: string;
  @Input({ required: true }) day!: TrainingPlanDayDto;
  @Input() preview: Signal<boolean> = signal(false);
  @Input() onEditDay!: (dayId: string) => void;
  @Input() onDeleteDay!: (dayId: string) => void;
  @Input() onAddExercise!: (dayId: string) => void;
  @Input() onDeleteExercise!: (exerciseId: string, dayId: string) => void;
  @Input() onReorderExercise!: (exerciseId: string, dayId: string, index: number) => void;
  @Input() onEditProgression!: (exerciseId: string) => void;
  @Input() onAddSet!: (exerciseId: string, dayId: string) => void;
  @Input() onEditSet!: (setId: string, exerciseId: string, dayId: string) => void;
  @Input() onDeleteSet!: (setId: string, exerciseId: string, dayId: string) => void;
  @Input() onReorderSet!: (setId: string, exerciseId: string, dayId: string, index: number) => void;

  onEditDayClick = () => this.onEditDay(this.day.id);
}
