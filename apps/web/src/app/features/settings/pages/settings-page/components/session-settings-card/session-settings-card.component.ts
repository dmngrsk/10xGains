import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatSlideToggleChange, MatSlideToggleModule } from '@angular/material/slide-toggle';
import { WorkoutPreferencesService } from '@shared/services/workout-preferences.service';

@Component({
  selector: 'txg-session-settings-card',
  standalone: true,
  imports: [MatCardModule, MatDividerModule, MatSlideToggleModule],
  templateUrl: './session-settings-card.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SessionSettingsCardComponent {
  private readonly preferences = inject(WorkoutPreferencesService);

  readonly plateCalculatorEnabled = this.preferences.plateCalculatorEnabled;
  readonly warmupSetsEnabled = this.preferences.warmupSetsEnabled;

  onPlateCalculatorToggled(event: MatSlideToggleChange): void {
    this.preferences.setPlateCalculatorEnabled(event.checked);
  }

  onWarmupSetsToggled(event: MatSlideToggleChange): void {
    this.preferences.setWarmupSetsEnabled(event.checked);
  }
}
