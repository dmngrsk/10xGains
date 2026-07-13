import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

@Component({
  selector: 'txg-progress-actions-bar',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatDividerModule,
  ],
  templateUrl: './progress-actions-bar.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProgressActionsBarComponent {
  @Input() summary: string = '';

  @Output() filterButtonClicked = new EventEmitter<void>();

  onFilterClicked(): void {
    this.filterButtonClicked.emit();
  }
}
