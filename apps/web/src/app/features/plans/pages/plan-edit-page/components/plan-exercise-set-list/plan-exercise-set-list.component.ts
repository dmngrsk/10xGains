import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input, Output, EventEmitter } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { PlanExerciseSetViewModel } from '@features/plans/models/plan.viewmodel';
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
  @Input({ required: true }) sets!: PlanExerciseSetViewModel[];
  @Input({ required: true }) isReadOnly!: boolean;

  @Output() setEdited = new EventEmitter<{setId: string, exerciseId: string, dayId: string}>();
  @Output() setDeleted = new EventEmitter<{setId: string, exerciseId: string, dayId: string}>();
  @Output() setReordered = new EventEmitter<{setId: string, exerciseId: string, dayId: string, newIndex: number}>();

  onSetEdited = (eventData: {setId: string, exerciseId: string, dayId: string}) => this.setEdited.emit(eventData);
  onSetDeleted = (eventData: {setId: string, exerciseId: string, dayId: string}) => this.setDeleted.emit(eventData);
  onSetReordered = (event: CdkDragDrop<PlanExerciseSetViewModel[]>): void => this.onSetItemDropped(event);

  onSetItemDropped(event: CdkDragDrop<PlanExerciseSetViewModel[]>): void {
    if (event.previousContainer === event.container && event.previousIndex !== event.currentIndex) {
      const [moved] = this.sets.splice(event.previousIndex, 1);
      this.sets.splice(event.currentIndex, 0, moved);
      this.sets.forEach((s, i) => s.setIndex = i + 1);
      this.setReordered.emit({ setId: moved.id, exerciseId: this.exerciseId, dayId: this.dayId, newIndex: event.currentIndex + 1 });
    }
  }
}
