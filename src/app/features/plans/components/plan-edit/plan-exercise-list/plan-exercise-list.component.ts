import { ChangeDetectionStrategy, Component, inject, Input, effect, Signal, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatExpansionModule } from '@angular/material/expansion';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { TrainingPlanExerciseDto } from '@shared/api/api.types';
import { PlanExerciseItemComponent } from '../plan-exercise-item/plan-exercise-item.component';
import { ExerciseService } from '@shared/services/exercise.service';

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
  styleUrls: ['./plan-exercise-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlanExerciseListComponent {
  @Input({ required: true }) planId!: string;
  @Input({ required: true }) dayId!: string;
  @Input() exercises: TrainingPlanExerciseDto[] = [];
  @Input() preview: Signal<boolean> = signal(false);
  @Input() onAddExercise!: (dayId: string) => void;
  @Input() onDeleteExercise!: (exerciseId: string, dayId: string) => void;
  @Input() onReorderExercise!: (exerciseId: string, dayId: string, index: number) => void;
  @Input() onEditProgression!: (exerciseId: string) => void;
  @Input() onAddSet!: (exerciseId: string, dayId: string) => void;
  @Input() onEditSet!: (setId: string, exerciseId: string, dayId: string) => void;
  @Input() onDeleteSet!: (setId: string, exerciseId: string, dayId: string) => void;
  @Input() onReorderSet!: (setId: string, exerciseId: string, dayId: string, index: number) => void;

  onAddExerciseClick = () => this.onAddExercise(this.dayId);

  exerciseService = inject(ExerciseService);
  getExerciseName = (exerciseId: string) => this.exerciseService.find(exerciseId)?.name;

  constructor() {
    effect(() => {
      if (this.preview()) {
        this.expandedStates.set(this.exercises.map(() => true));
      }
    });
  }

  expandedStates = signal<boolean[]>([]);

  onExerciseItemToggle(index: number, expanded: boolean) {
    const current = this.expandedStates();
    this.expandedStates.set(current.map((val, i) => (i === index ? expanded : val)));
  }

  onExerciseItemDrop(event: CdkDragDrop<TrainingPlanExerciseDto[]>): void {
    if (event.previousContainer === event.container && event.previousIndex !== event.currentIndex) {
      const [moved] = this.exercises.splice(event.previousIndex, 1);
      this.exercises.splice(event.currentIndex, 0, moved);
      this.exercises.forEach((e, i) => e.order_index = i + 1);
      this.onReorderExercise(moved.id, this.dayId, event.currentIndex + 1);
    }
  }
}
