import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatTooltipModule } from '@angular/material/tooltip';

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
  styleUrls: ['./history-actions-bar.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HistoryActionsBarComponent {
  @Input() length: number = 0;
  @Input() pageSize: number = 10;
  @Input() pageIndex: number = 0;
  @Input() pageSizeOptions: number[] = [5, 10, 25, 100];
  @Input() filterSpecified: boolean = false;

  @Output() filterButtonClicked = new EventEmitter<void>();
  @Output() pageChanged = new EventEmitter<PageEvent>();

  onPageChanged(event: PageEvent): void {
    this.pageChanged.emit(event);
  }

  onFilterClicked(): void {
    this.filterButtonClicked.emit();
  }
}
