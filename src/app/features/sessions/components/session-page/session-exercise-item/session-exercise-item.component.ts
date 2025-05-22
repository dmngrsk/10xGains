import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { SessionExerciseViewModel, SessionSetViewModel } from '../../../models/session-view.models';
import { SessionSetListComponent } from '../session-set-list/session-set-list.component';

@Component({
  selector: 'txg-session-exercise-item',
  standalone: true,
  imports: [
    CommonModule,
    SessionSetListComponent,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
  ],
  templateUrl: './session-exercise-item.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SessionExerciseItemComponent {
  @Input() exercise!: SessionExerciseViewModel;
  @Input() isReadOnly: boolean = false;

  @Output() setClicked = new EventEmitter<{ set: SessionSetViewModel; exerciseId: string }>();
  @Output() setLongPressed = new EventEmitter<{ set: SessionSetViewModel; exerciseId: string }>();
  @Output() setAdded = new EventEmitter<string>();

  get areAllSetsCompleted(): boolean {
    return this.exercise
      && this.exercise.sets
      && this.exercise.sets.length > 0
      && this.exercise.sets.every(set => set.status === 'COMPLETED' || set.status === 'FAILED');
  }

  get exerciseInfoText(): string {
    const setCount = this.exercise.sets.length;
    const minReps = this.exercise.sets.reduce((min, set) => Math.min(min, set.expectedReps), Infinity);
    const maxReps = this.exercise.sets.reduce((max, set) => Math.max(max, set.expectedReps), -Infinity);
    const minWeight = this.exercise.sets.reduce((min, set) => Math.min(min, set.weight || 0), Infinity);
    const maxWeight = this.exercise.sets.reduce((max, set) => Math.max(max, set.weight || 0), -Infinity);

    const setText = setCount + (setCount === 1 ? ' set' : ' sets');
    const repsText = minReps === maxReps ? `${minReps} reps` : `${minReps}-${maxReps} reps`;
    const weightText = minWeight === 0 ? '' : minWeight === maxWeight ? `@ ${minWeight} kg` : `@ ${minWeight}-${maxWeight} kg`;
    return `${setText} – ${repsText} ${weightText}`;
  }

  onSetClicked(setFromList: SessionSetViewModel): void {
    this.setClicked.emit({ set: setFromList, exerciseId: this.exercise.trainingPlanExerciseId });
  }

  onSetLongPressed(setFromList: SessionSetViewModel): void {
    this.setLongPressed.emit({ set: setFromList, exerciseId: this.exercise.trainingPlanExerciseId });
  }

  onSetAdded(exerciseId: string): void {
    this.setAdded.emit(exerciseId);
  }
}
