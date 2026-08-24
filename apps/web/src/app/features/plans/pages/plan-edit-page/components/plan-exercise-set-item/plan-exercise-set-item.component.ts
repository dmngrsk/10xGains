import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input, Output, EventEmitter, computed, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { PlanEditCapabilities } from '@features/plans/models/plan-edit-capabilities';
import { PlanExerciseSetViewModel } from '@features/plans/models/plan.viewmodel';

const DEFAULT_WEIGHT_INCREMENT = 2.5;

@Component({
  // An attribute selector, against the project rule: a custom element between <tbody> and <tr> is
  // not valid table structure, and the browser hoists it out.
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: '[txg-plan-exercise-set-item]',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
  ],
  templateUrl: './plan-exercise-set-item.component.html',
  styleUrl: './plan-exercise-set-item.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlanExerciseSetItemComponent {
  @Input({ required: true }) planId!: string;
  @Input({ required: true }) dayId!: string;
  @Input({ required: true }) exerciseId!: string;
  @Input({ required: true }) capabilities!: PlanEditCapabilities;
  @Input() weightIncrement: number | null = null;

  @Input({ required: true })
  set set(value: PlanExerciseSetViewModel) {
    this.setModel.set(value);
    this.pendingWeight.set(null);
  }
  get set(): PlanExerciseSetViewModel {
    return this.setModel();
  }

  private readonly setModel = signal<PlanExerciseSetViewModel>({} as PlanExerciseSetViewModel);

  private readonly pendingWeight = signal<number | null>(null);

  readonly displayedWeight = computed(() => this.pendingWeight() ?? this.setModel().expectedWeight ?? 0);

  @Output() setEdited = new EventEmitter<{setId: string, exerciseId: string, dayId: string}>();
  @Output() setWeightStepped = new EventEmitter<{setId: string, exerciseId: string, dayId: string, weight: number}>();

  get step(): number {
    return this.weightIncrement && this.weightIncrement > 0 ? this.weightIncrement : DEFAULT_WEIGHT_INCREMENT;
  }

  get canDecrease(): boolean {
    return this.capabilities.canEditSetValues && this.displayedWeight() > 0;
  }

  onSetEdited = () => this.setEdited.emit({ setId: this.set.id, exerciseId: this.exerciseId, dayId: this.dayId });

  onWeightStepped(direction: 1 | -1): void {
    if (!this.capabilities.canEditSetValues) {
      return;
    }

    const current = this.displayedWeight();
    const next = Math.max(0, Math.round((current + direction * this.step) * 1000) / 1000);
    if (next === current) {
      return;
    }

    this.pendingWeight.set(next);
    this.setWeightStepped.emit({ setId: this.set.id, exerciseId: this.exerciseId, dayId: this.dayId, weight: next });
  }
}
