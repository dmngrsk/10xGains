import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { SessionExerciseViewModel, SessionSetViewModel } from '../../../../models/session-page.viewmodel';
import { SessionExerciseItemComponent } from '../session-exercise-item/session-exercise-item.component';

@Component({
  selector: 'txg-session-exercise-list',
  standalone: true,
  imports: [
    CommonModule,
    SessionExerciseItemComponent,
  ],
  templateUrl: './session-exercise-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SessionExerciseListComponent {
  @Input() exercises: SessionExerciseViewModel[] = [];
  @Input() isReadOnly: boolean = false;

  @Output() setAdded = new EventEmitter<string>();
  @Output() setClicked = new EventEmitter<{ set: SessionSetViewModel; exerciseId: string }>();
  @Output() setLongPressed = new EventEmitter<{ set: SessionSetViewModel; exerciseId: string }>();

  onSetClicked(event: { set: SessionSetViewModel; exerciseId: string }): void {
    this.setClicked.emit(event);
  }

  onSetLongPressed(event: { set: SessionSetViewModel; exerciseId: string }): void {
    this.setLongPressed.emit(event);
  }

  onSetAdded(planExerciseId: string): void {
    this.setAdded.emit(planExerciseId);
  }
}
