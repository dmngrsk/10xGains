import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatTooltipModule } from '@angular/material/tooltip';
import { HistoryViewMode } from '@features/history/models/history-page.viewmodel';

@Component({
  selector: 'txg-history-actions-bar',
  standalone: true,
  imports: [
    CommonModule,
    MatPaginatorModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatDividerModule,
  ],
  templateUrl: './history-actions-bar.component.html',
  styleUrl: './history-actions-bar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HistoryActionsBarComponent {
  @Input() length: number = 0;
  @Input() pageSize: number = 10;
  @Input() pageIndex: number = 0;
  @Input() pageSizeOptions: number[] = [5, 10, 25, 100];
  @Input() viewMode: HistoryViewMode = 'list';
  @Input() planName: string = '';

  @Output() filterButtonClicked = new EventEmitter<void>();
  @Output() pageChanged = new EventEmitter<PageEvent>();
  @Output() viewModeChanged = new EventEmitter<HistoryViewMode>();

  onPageChanged(event: PageEvent): void {
    this.pageChanged.emit(event);
  }

  onFilterClicked(): void {
    this.filterButtonClicked.emit();
  }

  onViewToggleClicked(): void {
    if (this.viewMode === 'list') {
      this.viewModeChanged.emit('calendar');
    }
    if (this.viewMode === 'calendar') {
      this.viewModeChanged.emit('list');
    }
  }
}
