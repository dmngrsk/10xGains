import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input, signal, effect, Signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { TrainingPlanDayDto } from '@shared/api/api.types';
import { PlanDayItemComponent } from '../plan-day-item/plan-day-item.component';

@Component({
  selector: 'txg-plan-day-list',
  templateUrl: './plan-day-list.component.html',
  styleUrls: ['./plan-day-list.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    MatExpansionModule,
    MatButtonModule,
    MatIconModule,
    PlanDayItemComponent,
    DragDropModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlanDayListComponent {
  @Input({ required: true }) planId!: string;
  @Input() days: TrainingPlanDayDto[] = [];
  @Input() preview: Signal<boolean> = signal(false);
  @Input() onTogglePreview!: () => void;
  @Input() onAddDay!: () => void;
  @Input() onEditDay!: (dayId: string) => void;
  @Input() onDeleteDay!: (dayId: string) => void;
  @Input() onReorderDay!: (dayId: string, index: number) => void;
  @Input() onAddExercise!: (dayId: string) => void;
  @Input() onDeleteExercise!: (exerciseId: string, dayId: string) => void;
  @Input() onReorderExercise!: (exerciseId: string, dayId: string, index: number) => void;
  @Input() onEditProgression!: (exerciseId: string) => void;
  @Input() onAddSet!: (exerciseId: string, dayId: string) => void;
  @Input() onEditSet!: (setId: string, exerciseId: string, dayId: string) => void;
  @Input() onDeleteSet!: (setId: string, exerciseId: string, dayId: string) => void;
  @Input() onReorderSet!: (setId: string, exerciseId: string, dayId: string, index: number) => void;

  onPreviewClick = () => this.onTogglePreview();
  onAddDayClick = () => this.onAddDay();

  constructor() {
    effect(() => {
      if (this.preview()) {
        this.expandedStates.set(this.days.map(() => true));
      }
    });
  }

  expandedStates = signal<boolean[]>([]);

  onDayItemToggle(index: number, expanded: boolean) {
    const current = this.expandedStates();
    this.expandedStates.set(current.map((val, i) => (i === index ? expanded : val)));
  }

  onDayItemReorder(event: CdkDragDrop<TrainingPlanDayDto[]>) {
    if (event.previousContainer === event.container && event.previousIndex !== event.currentIndex) {
      const [moved] = this.days.splice(event.previousIndex, 1);
      this.days.splice(event.currentIndex, 0, moved);
      this.days.forEach((d, i) => d.order_index = i + 1);
      this.onReorderDay(moved.id, event.currentIndex + 1);
    }
  }
}
