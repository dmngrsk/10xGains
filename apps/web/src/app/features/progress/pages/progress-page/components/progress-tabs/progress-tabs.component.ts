import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { ProgressViewMode } from '@features/progress/models/progress-page.viewmodel';

interface ProgressTab {
  mode: ProgressViewMode;
  label: string;
  icon: string;
  dataCy: string;
}

@Component({
  selector: 'txg-progress-tabs',
  standalone: true,
  imports: [MatIconModule, MatTabsModule],
  templateUrl: './progress-tabs.component.html',
  styleUrl: './progress-tabs.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProgressTabsComponent {
  @Input() viewMode: ProgressViewMode = 'lifts';

  @Output() viewModeChanged = new EventEmitter<ProgressViewMode>();

  readonly tabs: ProgressTab[] = [
    { mode: 'lifts', label: 'Lifts', icon: 'fitness_center', dataCy: 'progress-tab-lifts' },
    { mode: 'body', label: 'Body', icon: 'straighten', dataCy: 'progress-tab-body' },
  ];

  onTabClicked(mode: ProgressViewMode): void {
    if (mode === this.viewMode) {
      return;
    }

    this.viewModeChanged.emit(mode);
  }
}
