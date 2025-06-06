import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input, signal, Output, EventEmitter, SimpleChanges, OnChanges } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { TrainingPlanDayViewModel, TrainingPlanExerciseProgressionViewModel } from '../../../../models/training-plan.viewmodel';
import { PlanDayItemComponent } from '../plan-day-item/plan-day-item.component';

@Component({
  selector: 'txg-plan-day-list',
  templateUrl: './plan-day-list.component.html',
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
export class PlanDayListComponent implements OnChanges {
  @Input({ required: true }) planId!: string;
  @Input({ required: true }) days!: TrainingPlanDayViewModel[];
  @Input({ required: true }) progressions!: TrainingPlanExerciseProgressionViewModel[];
  @Input({ required: true }) isReadOnly!: boolean;

  @Output() dayAdded = new EventEmitter<void>();
  @Output() dayEdited = new EventEmitter<{dayId: string}>();
  @Output() dayReordered = new EventEmitter<{dayId: string, newIndex: number}>();
  @Output() exerciseAdded = new EventEmitter<{dayId: string}>();
  @Output() exerciseDeleted = new EventEmitter<{exerciseId: string, exerciseName: string, dayId: string}>();
  @Output() exerciseReordered = new EventEmitter<{exerciseId: string, dayId: string, newIndex: number}>();
  @Output() progressionEdited = new EventEmitter<{exerciseId: string}>();
  @Output() setAdded = new EventEmitter<{exerciseId: string, dayId: string}>();
  @Output() setEdited = new EventEmitter<{setId: string, exerciseId: string, dayId: string}>();
  @Output() setDeleted = new EventEmitter<{setId: string, exerciseId: string, dayId: string}>();
  @Output() setReordered = new EventEmitter<{setId: string, exerciseId: string, dayId: string, newIndex: number}>();

  onDayAdded = () => this.dayAdded.emit();
  onDayEdited = (eventData: {dayId: string}) => this.dayEdited.emit(eventData);
  onDayReordered = (event: CdkDragDrop<TrainingPlanDayViewModel[]>) => this.onDayItemDropped(event);
  onExerciseAdded = (eventData: {dayId: string}) => this.exerciseAdded.emit(eventData);
  onExerciseDeleted = (eventData: {exerciseId: string, exerciseName: string, dayId: string}) => this.exerciseDeleted.emit(eventData);
  onExerciseReordered = (eventData: {exerciseId: string, dayId: string, newIndex: number}) => this.exerciseReordered.emit(eventData);
  onProgressionEdited = (eventData: {exerciseId: string}) => this.progressionEdited.emit(eventData);
  onSetAdded = (eventData: {exerciseId: string, dayId: string}) => this.setAdded.emit(eventData);
  onSetEdited = (eventData: {setId: string, exerciseId: string, dayId: string}) => this.setEdited.emit(eventData);
  onSetDeleted = (eventData: {setId: string, exerciseId: string, dayId: string}) => this.setDeleted.emit(eventData);
  onSetReordered = (eventData: {setId: string, exerciseId: string, dayId: string, newIndex: number}) => this.setReordered.emit(eventData);

  expandedStates = signal<boolean[]>([]);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isReadOnly']) {
      const isReadOnlyValue = changes['isReadOnly'].currentValue as boolean;
      if (isReadOnlyValue) {
        this.expandedStates.set(this.days.map(() => true));
      }
    }
  }

  onDayItemDropped(event: CdkDragDrop<TrainingPlanDayViewModel[]>) {
    if (event.previousContainer === event.container && event.previousIndex !== event.currentIndex) {
      const [moved] = this.days.splice(event.previousIndex, 1);
      this.days.splice(event.currentIndex, 0, moved);
      this.days.forEach((d, i) => d.orderIndex = i + 1);
      this.dayReordered.emit({dayId: moved.id, newIndex: event.currentIndex + 1});
    }
  }

  onDayItemToggled(index: number, expanded: boolean) {
    const current = this.expandedStates();
    this.expandedStates.set(current.map((val, i) => (i === index ? expanded : val)));
  }
}
