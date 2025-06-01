import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { TrainingPlanViewModel } from '../../../../models/training-plan.viewmodel';
import { PlanCardComponent } from '../plan-card/plan-card.component';

@Component({
  selector: 'txg-plan-list',
  templateUrl: './plan-list.component.html',
  standalone: true,
  imports: [CommonModule, MatCardModule, PlanCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlanListComponent {
  @Input({ required: true }) plans!: TrainingPlanViewModel[];
  @Output() planClicked = new EventEmitter<string>();

  onPlanClicked(planId: string): void {
    this.planClicked.emit(planId);
  }
}
