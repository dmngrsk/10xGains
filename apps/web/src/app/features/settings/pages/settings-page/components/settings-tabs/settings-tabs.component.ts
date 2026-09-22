import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { SettingsViewMode } from '@features/settings/models/settings-page.viewmodel';

interface SettingsTab {
  mode: SettingsViewMode;
  label: string;
  icon: string;
  dataCy: string;
}

@Component({
  selector: 'txg-settings-tabs',
  standalone: true,
  imports: [
    MatIconModule,
    MatTabsModule,
  ],
  templateUrl: './settings-tabs.component.html',
  styleUrl: './settings-tabs.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsTabsComponent {
  @Input() viewMode: SettingsViewMode = 'workout';

  @Output() viewModeChanged = new EventEmitter<SettingsViewMode>();

  readonly tabs: SettingsTab[] = [
    { mode: 'workout', label: 'Workout', icon: 'fitness_center', dataCy: 'settings-tab-workout' },
    { mode: 'measurements', label: 'Measurements', icon: 'straighten', dataCy: 'settings-tab-measurements' },
    { mode: 'user', label: 'User', icon: 'person', dataCy: 'settings-tab-user' },
  ];

  onTabClicked(mode: SettingsViewMode): void {
    if (mode === this.viewMode) {
      return;
    }

    this.viewModeChanged.emit(mode);
  }
}
