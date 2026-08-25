import { CommonModule } from '@angular/common';
import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { PlanDto } from '@txg/shared';
import { PlanEditCapabilities } from '@features/plans/models/plan-edit-capabilities';

@Component({
  selector: 'txg-plan-metadata',
  templateUrl: './plan-metadata.component.html',
  styleUrl: './plan-metadata.component.scss',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlanMetadataComponent {
  @Input() plan: Pick<PlanDto, 'name' | 'description'> | null = null;
  @Input() sessionCount: number = 0;
  @Input() isActive = false;
  @Input({ required: true }) capabilities!: PlanEditCapabilities;

  @Output() planEdited = new EventEmitter<void>();

  get showActiveNotice(): boolean {
    return this.isActive;
  }

  get showHistoryNotice(): boolean {
    return this.sessionCount > 0 && this.capabilities.canEditSetValues;
  }
}
