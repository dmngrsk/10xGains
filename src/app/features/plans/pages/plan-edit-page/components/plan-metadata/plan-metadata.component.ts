import { CommonModule } from '@angular/common';
import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
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
  @Input() sessionCount: number = 0;
}
