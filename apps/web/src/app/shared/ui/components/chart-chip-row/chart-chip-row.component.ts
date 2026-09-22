import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { MatChipSelectionChange, MatChipsModule } from '@angular/material/chips';
import { wouldEmptySelection } from '@shared/utils/charts/series-selection';
import { AutoHideScrollbarDirective } from '@shared/utils/directives/auto-hide-scrollbar.directive';

export interface ChartChipViewModel {
  id: string;
  label: string;
  colorToken: string;
  selected: boolean;
}

@Component({
  selector: 'txg-chart-chip-row',
  standalone: true,
  imports: [MatChipsModule, AutoHideScrollbarDirective],
  templateUrl: './chart-chip-row.component.html',
  styleUrl: './chart-chip-row.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.txg-chart-chip-row--wrapped]': 'wrap' },
})
export class ChartChipRowComponent {
  @Input({ required: true }) chips: ChartChipViewModel[] = [];
  @Input() wrap = false;
  @Input({ required: true }) dataCyPrefix = '';

  @Output() chipToggled = new EventEmitter<string>();

  onSelectionChanged(id: string, event: MatChipSelectionChange): void {
    if (!event.isUserInput) {
      return;
    }

    const target = this.chips.find(chip => chip.id === id);
    if (wouldEmptySelection(this.chips, target)) {
      event.source.selected = true;
      return;
    }

    this.chipToggled.emit(id);
  }
}
