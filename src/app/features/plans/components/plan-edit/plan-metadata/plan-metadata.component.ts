import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { TrainingPlanDto } from '@shared/api/api.types';

@Component({
  selector: 'txg-plan-metadata',
  templateUrl: './plan-metadata.component.html',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlanMetadataComponent {
  @Input() plan: Pick<TrainingPlanDto, 'name' | 'description'> | null = null;
  @Input() onEditPlan!: () => void;
}
