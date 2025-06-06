import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { TrainingPlanExerciseSetViewModel, TrainingPlanViewModel } from '../../../../models/training-plan.viewmodel';

@Component({
  selector: 'txg-plan-card',
  templateUrl: './plan-card.component.html',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlanCardComponent {
  @Input({ required: true }) plan!: TrainingPlanViewModel;
  @Output() planClicked = new EventEmitter<string>();

  getExerciseSummaryText(sets: TrainingPlanExerciseSetViewModel[]): string {
    if (!sets || sets.length === 0) {
      return 'No sets defined';
    }

    let repsSummaryStr = '';
    let weightSummaryStr = '';

    const repCounts: number[] = sets.map(s => s.expectedReps ?? 0);
    const weightValues: number[] = sets.map(s => s.expectedWeight ?? 0);

    if (repCounts.length === 0) {
      return 'No reps defined';
    } else {
      const allRepsSame = repCounts.every(r => r === repCounts[0]);
      if (allRepsSame) {
        repsSummaryStr = `${repCounts.length}x${repCounts[0]}`;
      } else {
        repsSummaryStr = repCounts.join('/');
      }
    }

    if (weightValues.length > 0) {
      const minWeight = Math.min(...weightValues);
      const maxWeight = Math.max(...weightValues);
      if (minWeight === maxWeight) {
        weightSummaryStr = `${minWeight} kg`;
      } else {
        weightSummaryStr = `${minWeight}-${maxWeight} kg`;
      }
    }

    return weightSummaryStr ? `${repsSummaryStr} @ ${weightSummaryStr}` : repsSummaryStr;
  }

  onPlanClicked(): void {
    this.planClicked.emit(this.plan.id);
  }
}
