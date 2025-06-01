import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input, Signal, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TrainingPlanExerciseSetDto } from '@shared/api/api.types';
import { PlanExerciseSetItemComponent } from '../plan-exercise-set-item/plan-exercise-set-item.component';

@Component({
  selector: 'txg-plan-exercise-set-list',
  standalone: true,
  imports: [
    CommonModule,
    PlanExerciseSetItemComponent,
    MatButtonModule,
    MatIconModule,
    DragDropModule,
  ],
  templateUrl: './plan-exercise-set-list.component.html',
  styleUrls: ['./plan-exercise-set-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlanExerciseSetListComponent {
  @Input({ required: true }) planId!: string;
  @Input({ required: true }) dayId!: string;
  @Input({ required: true }) exerciseId!: string;
  @Input() sets: TrainingPlanExerciseSetDto[] = [];
  @Input() preview: Signal<boolean> = signal(false);
  @Input() onAddSet!: (exerciseId: string, dayId: string) => void;
  @Input() onEditSet!: (setId: string, exerciseId: string, dayId: string) => void;
  @Input() onDeleteSet!: (setId: string, exerciseId: string, dayId: string) => void;
  @Input() onReorderSet!: (setId: string, exerciseId: string, dayId: string, index: number) => void;

  onAddSetClick = () => this.onAddSet(this.exerciseId, this.dayId);

  onSetItemDrop(event: CdkDragDrop<TrainingPlanExerciseSetDto[]>): void {
    if (event.previousContainer === event.container && event.previousIndex !== event.currentIndex) {
      const [moved] = this.sets.splice(event.previousIndex, 1);
      this.sets.splice(event.currentIndex, 0, moved);
      this.sets.forEach((s, i) => s.set_index = i + 1);
      this.onReorderSet(moved.id, this.exerciseId, this.dayId, event.currentIndex + 1);
    }
  }
}
