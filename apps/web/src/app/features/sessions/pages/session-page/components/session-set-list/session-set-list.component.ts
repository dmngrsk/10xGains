import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, computed, signal } from '@angular/core';
import { AutoHideScrollbarDirective } from '@shared/utils/directives/auto-hide-scrollbar.directive';
import { SessionExerciseViewModel, SessionSetViewModel, SessionWarmupSetViewModel } from '../../../../models/session-page.viewmodel';
import { calculateWarmupSets } from '../../utils/warmup.utils';
import { SessionSetBubbleComponent } from '../session-set-bubble/session-set-bubble.component';
import { SessionWarmupBubbleComponent } from '../session-warmup-bubble/session-warmup-bubble.component';

type WarmupDisplayState = 'collapsed' | 'expanded' | 'dismissed';

@Component({
  selector: 'txg-session-set-list',
  standalone: true,
  imports: [
    SessionSetBubbleComponent,
    SessionWarmupBubbleComponent,
    AutoHideScrollbarDirective,
  ],
  templateUrl: './session-set-list.component.html',
  styleUrl: './session-set-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SessionSetListComponent {
  private readonly exerciseSignal = signal<SessionExerciseViewModel | null>(null);
  private readonly readOnlySignal = signal<boolean>(false);

  @Input({ required: true }) set exercise(value: SessionExerciseViewModel) {
    this.exerciseSignal.set(value);
  }
  get exercise(): SessionExerciseViewModel {
    return this.exerciseSignal()!;
  }

  @Input() set isReadOnly(value: boolean) {
    this.readOnlySignal.set(value);
  }
  get isReadOnly(): boolean {
    return this.readOnlySignal();
  }

  @Output() setClicked = new EventEmitter<SessionSetViewModel>();
  @Output() setLongPressed = new EventEmitter<SessionSetViewModel>();
  @Output() setAdded = new EventEmitter<string>();

  private readonly expanded = signal<boolean>(false);
  private readonly removedWarmupSetIds = signal<readonly string[]>([]);

  readonly warmupSets = computed<SessionWarmupSetViewModel[]>(() => {
    const sets = this.exerciseSignal()?.sets ?? [];
    const workingWeight = Math.max(0, ...sets.map(s => s.weight ?? 0));
    const removedIds = this.removedWarmupSetIds();
    return calculateWarmupSets(workingWeight).filter(s => !removedIds.includes(s.id));
  });

  readonly warmupState = computed<WarmupDisplayState>(() => {
    const hasInteractedSets = (this.exerciseSignal()?.sets ?? []).some(s => s.status !== 'PENDING');
    if (this.readOnlySignal() || hasInteractedSets || this.warmupSets().length === 0) {
      return 'dismissed';
    }
    return this.expanded() ? 'expanded' : 'collapsed';
  });

  onWarmupToggleClicked(): void {
    this.expanded.set(true);
  }

  onWarmupSetClicked(warmupSetId: string): void {
    this.removedWarmupSetIds.update(ids => [...ids, warmupSetId]);
  }

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
