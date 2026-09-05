import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatSlideToggleChange, MatSlideToggleModule } from '@angular/material/slide-toggle';
import { WorkoutPreferencesService } from '@shared/services/workout-preferences.service';

@Component({
  selector: 'txg-workout-settings-card',
  standalone: true,
  imports: [MatCardModule, MatSlideToggleModule],
  templateUrl: './workout-settings-card.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkoutSettingsCardComponent {
  private readonly preferences = inject(WorkoutPreferencesService);

  readonly plateCalculatorEnabled = this.preferences.plateCalculatorEnabled;

  onPlateCalculatorToggled(event: MatSlideToggleChange): void {
    this.preferences.setPlateCalculatorEnabled(event.checked);
  }
}
