import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, computed, inject, signal } from '@angular/core';
import { WorkoutPreferencesService } from '@shared/services/workout-preferences.service';
import { AutoHideScrollbarDirective } from '@shared/utils/directives/auto-hide-scrollbar.directive';
import { SessionExerciseViewModel, SessionSetViewModel, SessionWarmupSetViewModel } from '../../../../models/session-page.viewmodel';
import { calculateWarmupSets } from '../../utils/warmup.utils';
import { SessionSetBubbleComponent } from '../session-set-bubble/session-set-bubble.component';
import { SessionWarmupBubbleComponent } from '../session-warmup-bubble/session-warmup-bubble.component';

type WarmupDisplayState = 'collapsed' | 'expanded' | 'dismissed';

export interface WarmupRampChange {
  exerciseId: string;
  nextWarmupWeightKg: number | null;
}

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
  private readonly preferences = inject(WorkoutPreferencesService);

  private readonly exerciseSignal = signal<SessionExerciseViewModel | null>(null);
  private readonly startedSignal = signal<boolean>(false);
  private readonly readOnlySignal = signal<boolean>(false);

  @Input({ required: true }) set exercise(value: SessionExerciseViewModel) {
    this.exerciseSignal.set(value);
    this.emitWarmupChange();
  }
  get exercise(): SessionExerciseViewModel {
    return this.exerciseSignal()!;
  }

  @Input() set isStarted(value: boolean) {
    this.startedSignal.set(value);
    this.emitWarmupChange();
  }
  get isStarted(): boolean {
    return this.startedSignal();
  }

  @Input() set isReadOnly(value: boolean) {
    this.readOnlySignal.set(value);
    this.emitWarmupChange();
  }
  get isReadOnly(): boolean {
    return this.readOnlySignal();
  }

  @Output() setClicked = new EventEmitter<SessionSetViewModel>();
  @Output() setLongPressed = new EventEmitter<SessionSetViewModel>();
  @Output() setAdded = new EventEmitter<string>();
  @Output() warmupChanged = new EventEmitter<WarmupRampChange>();

  private readonly expanded = signal<boolean>(false);
  private readonly removedWarmupSetIds = signal<readonly string[]>([]);
  private lastEmittedWarmupWeightKg: number | null = null;

  readonly warmupSets = computed<SessionWarmupSetViewModel[]>(() => {
    const sets = this.exerciseSignal()?.sets ?? [];
    const workingWeight = Math.max(0, ...sets.map(s => s.weight ?? 0));
    const removedIds = this.removedWarmupSetIds();
    return calculateWarmupSets(workingWeight).filter(s => !removedIds.includes(s.id));
  });

  readonly warmupState = computed<WarmupDisplayState>(() => {
    if (!this.preferences.warmupSetsEnabled() || this.readOnlySignal() || this.startedSignal() || this.warmupSets().length === 0) {
      return 'dismissed';
    }
    return this.expanded() ? 'expanded' : 'collapsed';
  });

  readonly nextWarmupWeightKg = computed<number | null>(() =>
    this.warmupState() === 'expanded' ? this.warmupSets()[0]?.weight ?? null : null);

  onWarmupToggleClicked(): void {
    this.expanded.set(true);
    this.emitWarmupChange();
  }

  onWarmupSetClicked(warmupSetId: string): void {
    this.removedWarmupSetIds.update(ids => [...ids, warmupSetId]);
    this.emitWarmupChange();
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

  private emitWarmupChange(): void {
    const nextWarmupWeightKg = this.nextWarmupWeightKg();
    if (nextWarmupWeightKg === this.lastEmittedWarmupWeightKg) {
      return;
    }

    this.lastEmittedWarmupWeightKg = nextWarmupWeightKg;
    this.warmupChanged.emit({ exerciseId: this.exercise.planExerciseId, nextWarmupWeightKg });
  }
}
