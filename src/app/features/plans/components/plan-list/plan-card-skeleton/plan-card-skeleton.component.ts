import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';

@Component({
  selector: 'txg-plan-card-skeleton',
  templateUrl: './plan-card-skeleton.component.html',
  standalone: true,
  imports: [MatCardModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlanCardSkeletonComponent {}
