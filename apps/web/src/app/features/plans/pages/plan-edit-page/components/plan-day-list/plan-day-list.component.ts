import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input, signal, Output, EventEmitter, SimpleChanges, OnChanges } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTabsModule } from '@angular/material/tabs';
import { PlanEditCapabilities } from '../../../../models/plan-edit-capabilities';
import { PlanDayViewModel, PlanExerciseProgressionViewModel } from '../../../../models/plan.viewmodel';
import { PlanExerciseListComponent } from '../plan-exercise-list/plan-exercise-list.component';

@Component({
  selector: 'txg-plan-day-list',
  templateUrl: './plan-day-list.component.html',
  styleUrl: './plan-day-list.component.scss',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatTabsModule,
    PlanExerciseListComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlanDayListComponent implements OnChanges {
  @Input({ required: true }) planId!: string;
  @Input({ required: true }) days!: PlanDayViewModel[];
  @Input({ required: true }) progressions!: PlanExerciseProgressionViewModel[];
  @Input({ required: true }) capabilities!: PlanEditCapabilities;

  @Output() dayAdded = new EventEmitter<void>();
  @Output() dayEdited = new EventEmitter<{dayId: string}>();
  @Output() daysReordered = new EventEmitter<void>();
  @Output() exerciseAdded = new EventEmitter<{dayId: string}>();
  @Output() exerciseDeleted = new EventEmitter<{exerciseId: string, exerciseName: string, dayId: string}>();
  @Output() exerciseArchived = new EventEmitter<{exerciseId: string, exerciseName: string, dayId: string}>();
  @Output() exerciseReordered = new EventEmitter<{exerciseId: string, dayId: string, newIndex: number}>();
  @Output() progressionEdited = new EventEmitter<{exerciseId: string}>();
  @Output() setAdded = new EventEmitter<{exerciseId: string, dayId: string}>();
  @Output() setEdited = new EventEmitter<{setId: string, exerciseId: string, dayId: string}>();
  @Output() setWeightStepped = new EventEmitter<{setId: string, exerciseId: string, dayId: string, weight: number}>();

  /**
   * By id, not position: reordering and archiving both move a day under its index, and Material's
   * tab group follows the tab, so an index held here drifts out of step with the strip.
   */
  private readonly selectedDayId = signal<string | null>(null);

  get selectedDay(): PlanDayViewModel | null {
    if (!this.days?.length) {
      return null;
    }
    return this.days.find(d => d.id === this.selectedDayId()) ?? this.days[0];
  }

  get selectedIndex(): number {
    const selected = this.selectedDay;
    return selected ? this.days.findIndex(d => d.id === selected.id) : 0;
  }

  get hasDayMenuActions(): boolean {
    return this.capabilities.canEditPlanMetadata
      || this.capabilities.canAddItems
      || (this.capabilities.canReorder && this.days.length > 1);
  }

  onDayAdded = () => this.dayAdded.emit();
  onDaysReordered = () => this.daysReordered.emit();
  onExerciseAdded = (eventData: {dayId: string}) => this.exerciseAdded.emit(eventData);
  onExerciseDeleted = (eventData: {exerciseId: string, exerciseName: string, dayId: string}) => this.exerciseDeleted.emit(eventData);
  onExerciseArchived = (eventData: {exerciseId: string, exerciseName: string, dayId: string}) => this.exerciseArchived.emit(eventData);
  onExerciseReordered = (eventData: {exerciseId: string, dayId: string, newIndex: number}) => this.exerciseReordered.emit(eventData);
  onProgressionEdited = (eventData: {exerciseId: string}) => this.progressionEdited.emit(eventData);
  onSetAdded = (eventData: {exerciseId: string, dayId: string}) => this.setAdded.emit(eventData);
  onSetEdited = (eventData: {setId: string, exerciseId: string, dayId: string}) => this.setEdited.emit(eventData);
  onSetWeightStepped = (eventData: {setId: string, exerciseId: string, dayId: string, weight: number}) => this.setWeightStepped.emit(eventData);

  onDayEdited(): void {
    const day = this.selectedDay;
    if (day) {
      this.dayEdited.emit({ dayId: day.id });
    }
  }

  onDaySelected(index: number): void {
    const day = this.days?.[index];
    if (day) {
      this.selectedDayId.set(day.id);
    }
  }

  private previousDayIds: string[] = [];

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['days']) {
      return;
    }

    const dayIds = (this.days ?? []).map(d => d.id);
    const selectedId = this.selectedDayId();

    if (selectedId && !dayIds.includes(selectedId)) {
      this.selectedDayId.set(null);
    }

    const addedIds = dayIds.filter(id => !this.previousDayIds.includes(id));
    if (this.previousDayIds.length > 0 && addedIds.length === 1) {
      this.selectedDayId.set(addedIds[0]);
    }

    if (!this.selectedDayId() && dayIds.length) {
      this.selectedDayId.set(dayIds[0]);
    }

    this.previousDayIds = dayIds;
  }
}
