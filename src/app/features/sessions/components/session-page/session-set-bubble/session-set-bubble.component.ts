import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect, EventEmitter, Input, Output, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatRippleModule } from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';
import { LongPressDirective } from '@shared/utils/directives/long-press.directive';
import { SessionSetStatus, SessionSetViewModel } from '../../../models/session-view.models';

interface NextSetStateAttributes {
  status: SessionSetStatus;
  actualReps: number | undefined;
  weight: number | undefined;
}

@Component({
  selector: 'txg-session-set-bubble',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatRippleModule,
    MatIconModule,
    LongPressDirective
  ],
  templateUrl: './session-set-bubble.component.html',
  styleUrls: ['./session-set-bubble.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SessionSetBubbleComponent {
  @Input() set!: SessionSetViewModel;
  @Input() isAddAction: boolean = false;
  @Input() isReadOnly: boolean = false;

  @Output() setClicked = new EventEmitter<SessionSetViewModel>();
  @Output() setLongPressed = new EventEmitter<SessionSetViewModel>();
  @Output() setAdded = new EventEmitter<void>();

  private optimisticSet = signal(this.set);

  get setVm(): SessionSetViewModel | null {
    if (this.isAddAction) return null;
    return this.optimisticSet();
  }

  get bubbleText(): string | null {
    if (this.isAddAction) return null;

    const current = this.optimisticSet();
    if (!current) return '-';

    switch (current.status) {
      case 'COMPLETED':
        return (current.actualReps ?? current.expectedReps).toString();
      case 'FAILED':
        return (current.actualReps ?? '0').toString();
      default:
        return (current.expectedReps).toString();
    }
  }

  get bubbleWeightText(): string | null {
    if (this.isAddAction) return null;

    return this.set?.weight?.toString() ?? null;
  }

  constructor() {
    effect(() => this.optimisticSet.set(this.set));
  }

  onSetClicked(): void {
    if (this.isReadOnly) return;

    const currentDisplayState = this.optimisticSet();
    if (!currentDisplayState) return;

    let nextStateAttributes: NextSetStateAttributes;

    switch (currentDisplayState.status) {
      case 'PENDING':
      case 'SKIPPED':
        nextStateAttributes = this.getTransitionFromPending(currentDisplayState);
        break;
      case 'COMPLETED':
        nextStateAttributes = this.getTransitionFromCompleted(currentDisplayState);
        break;
      case 'FAILED':
        nextStateAttributes = this.getTransitionFromFailed(currentDisplayState);
        break;
      default:
        console.warn('Unexpected set status in bubble interaction:', currentDisplayState.status);
        return;
    }

    const newOptimisticState: SessionSetViewModel = {
      ...currentDisplayState,
      ...nextStateAttributes,
    };

    this.optimisticSet.set(newOptimisticState);
    this.setClicked.emit(newOptimisticState);
  }

  onSetLongPressed(): void {
    if (this.isReadOnly) return;
    this.setLongPressed.emit(this.set);
  }

  onAddClicked(): void {
    if (this.isReadOnly) return;
    this.setAdded.emit();
  }

  private getTransitionFromPending(currentSet: SessionSetViewModel): NextSetStateAttributes {
    return {
      status: 'COMPLETED',
      actualReps: currentSet.expectedReps,
      weight: currentSet.weight,
    };
  }

  private getTransitionFromCompleted(currentSet: SessionSetViewModel): NextSetStateAttributes {
    const expectedReps = currentSet.expectedReps;
    const currentActualReps = currentSet.actualReps ?? expectedReps;
    let nextActualReps: number;
    let nextStatus: SessionSetStatus;

    if (typeof currentActualReps === 'number') {
      nextActualReps = currentActualReps - 1;
    } else {
      nextActualReps = 0;
    }

    if (nextActualReps < 0) {
      nextStatus = 'FAILED';
      nextActualReps = 0;
    } else if (nextActualReps < expectedReps) {
      nextStatus = 'FAILED';
    } else {
      nextStatus = 'COMPLETED';
    }

    return {
      status: nextStatus,
      actualReps: nextActualReps,
      weight: currentSet.weight,
    };
  }

  private getTransitionFromFailed(currentSet: SessionSetViewModel): NextSetStateAttributes {
    const currentActualRepsOnFailedSet = currentSet.actualReps ?? 0;
    let nextActualReps: number | undefined;
    let nextStatus: SessionSetStatus;

    if (currentActualRepsOnFailedSet === 0) {
      nextStatus = 'PENDING';
      nextActualReps = undefined;
    } else {
      nextActualReps = currentActualRepsOnFailedSet - 1;
      if (nextActualReps < 0) {
        nextActualReps = 0;
      }
      nextStatus = 'FAILED';
    }

    return {
      status: nextStatus,
      actualReps: nextActualReps,
      weight: currentSet.weight,
    };
  }
}
