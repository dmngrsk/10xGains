import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { AutoHideScrollbarDirective } from '@shared/utils/directives/auto-hide-scrollbar.directive';
import { SessionExerciseViewModel, SessionSetViewModel } from '../../../../models/session-page.viewmodel';
import { SessionSetBubbleComponent } from '../session-set-bubble/session-set-bubble.component';

@Component({
  selector: 'txg-session-set-list',
  standalone: true,
  imports: [
    CommonModule,
    SessionSetBubbleComponent,
    MatButtonModule,
    MatIconModule,
    AutoHideScrollbarDirective,
  ],
  templateUrl: './session-set-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SessionSetListComponent {
  @Input() exercise!: SessionExerciseViewModel;
  @Input() isReadOnly: boolean = false;

  @Output() setClicked = new EventEmitter<SessionSetViewModel>();
  @Output() setLongPressed = new EventEmitter<SessionSetViewModel>();
  @Output() setAdded = new EventEmitter<string>();

  onSetClicked(set: SessionSetViewModel): void {
    this.setClicked.emit(set);
  }

  onSetLongPressed(set: SessionSetViewModel): void {
    this.setLongPressed.emit(set);
  }

  onSetAdded(): void {
    this.setAdded.emit(this.exercise.planExerciseId);
  }
}
