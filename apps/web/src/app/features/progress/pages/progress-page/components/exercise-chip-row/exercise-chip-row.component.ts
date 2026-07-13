import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { MatChipSelectionChange, MatChipsModule } from '@angular/material/chips';
import { ExerciseSeriesViewModel } from '@features/progress/models/progress-page.viewmodel';
import { AutoHideScrollbarDirective } from '@shared/utils/directives/auto-hide-scrollbar.directive';

@Component({
  selector: 'txg-exercise-chip-row',
  standalone: true,
  imports: [CommonModule, MatChipsModule, AutoHideScrollbarDirective],
  templateUrl: './exercise-chip-row.component.html',
  styleUrl: './exercise-chip-row.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExerciseChipRowComponent {
  @Input() exercises: ExerciseSeriesViewModel[] = [];

  @Output() exerciseToggled = new EventEmitter<string>();

  onSelectionChanged(exerciseId: string, event: MatChipSelectionChange): void {
    if (!event.isUserInput) {
      return;
    }
    this.exerciseToggled.emit(exerciseId);
  }
}
