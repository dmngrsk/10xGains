import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { HistoryViewMode } from '@features/history/models/history-page.viewmodel';

interface HistoryTab {
  mode: HistoryViewMode;
  label: string;
  icon: string;
  dataCy: string;
}

@Component({
  selector: 'txg-history-tabs',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatTabsModule,
  ],
  templateUrl: './history-tabs.component.html',
  styleUrl: './history-tabs.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HistoryTabsComponent {
  @Input() viewMode: HistoryViewMode = 'calendar';

  @Output() viewModeChanged = new EventEmitter<HistoryViewMode>();

  // A nav bar rather than a tab group: the page already renders each view off `viewMode` and
  // keeps it in the query string, so the tabs only have to report which one was picked.
  readonly tabs: HistoryTab[] = [
    { mode: 'calendar', label: 'Calendar', icon: 'calendar_month', dataCy: 'history-tab-calendar' },
    { mode: 'list', label: 'List', icon: 'list', dataCy: 'history-tab-list' },
    { mode: 'notes', label: 'Notes', icon: 'sticky_note_2', dataCy: 'history-tab-notes' },
  ];

  onTabClicked(mode: HistoryViewMode): void {
    if (mode === this.viewMode) {
      return;
    }

    this.viewModeChanged.emit(mode);
  }
}
