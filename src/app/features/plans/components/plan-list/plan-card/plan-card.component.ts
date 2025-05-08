import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { CommonModule } from '@angular/common'; // For @if, @for etc.
import { PlanListItemViewModel } from '../../../shared/models/plan-list-item.view-model';

@Component({
  selector: 'txg-plan-card',
  templateUrl: './plan-card.component.html',
  standalone: true,
  imports: [CommonModule, MatCardModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlanCardComponent {
  @Input({ required: true }) plan!: PlanListItemViewModel;
  @Output() planClicked = new EventEmitter<string>();

  onCardClick(): void {
    this.planClicked.emit(this.plan.id);
  }
}
