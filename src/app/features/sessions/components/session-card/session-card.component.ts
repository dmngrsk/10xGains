import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input, Output, EventEmitter } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { SessionCardViewModel, SessionCardSetViewModel, SessionCardExerciseViewModel } from '../../models/session-card.viewmodel';

@Component({
  selector: 'txg-session-card',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule
  ],
  templateUrl: './session-card.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SessionCardComponent {
  @Input() sessionData!: SessionCardViewModel;
  @Output() sessionNavigated = new EventEmitter<string>();

  get buttonText(): string {
    if (!this.sessionData) return '';

    switch (this.sessionData.status) {
      case 'PENDING':
        return 'Start Session';
      case 'IN_PROGRESS':
        return 'Continue Session';
      case 'COMPLETED':
      case 'CANCELLED':
        return 'View Details';
      default:
        return '';
    }
  }

  get sessionDateTimeText(): string {
    if (!this.sessionData) return '';

    const displayDate = this.formatDisplayDate(this.sessionData.sessionDate);
    if (!displayDate) return '';

    switch (this.sessionData.status) {
      case 'PENDING': {
        return displayDate;
      }

      case 'IN_PROGRESS': {
        const sessionStartTime = this.getEarliestSetCompletionTime(this.sessionData.exercises);
        const sessionStartTimeFormatted = this.formatDisplayTime(sessionStartTime);

        if (sessionStartTime && sessionStartTimeFormatted) {
          const now = new Date();
          const durationMinutes = Math.round((now.getTime() - sessionStartTime.getTime()) / (1000 * 60));
          return `${displayDate} | ${sessionStartTimeFormatted} - ... (${durationMinutes} min)`;
        }

        return displayDate;
      }

      case 'COMPLETED':
      case 'CANCELLED': {
        const sessionStartTime = this.getEarliestSetCompletionTime(this.sessionData.exercises);
        const sessionEndTime = this.getLatestSetCompletionTime(this.sessionData.exercises);

        if (sessionStartTime && sessionEndTime) {
          const sessionStartTimeFormatted = this.formatDisplayTime(sessionStartTime);
          const sessionEndTimeFormatted = this.formatDisplayTime(sessionEndTime);

          if (sessionStartTime.getTime() === sessionEndTime.getTime()) {
            return `${displayDate} | ${sessionStartTimeFormatted}`;
          } else {
            const durationMinutes = Math.round((sessionEndTime.getTime() - sessionStartTime.getTime()) / (1000 * 60));
            return `${displayDate} | ${sessionStartTimeFormatted} - ${sessionEndTimeFormatted} (${durationMinutes} min)`;
          }
        }

        return displayDate;
      }
      default:
        return displayDate;
    }
  }

  get isActiveSession(): boolean {
    return this.sessionData.status === 'IN_PROGRESS' || this.sessionData.status === 'PENDING';
  }

  getExerciseSummaryText(sets: SessionCardSetViewModel[]): string {
    if (!sets || sets.length === 0) {
      return 'No sets defined';
    }

    let repsSummaryStr = '';
    let weightSummaryStr = '';

    const repCounts: number[] = sets
      .map(s => s.actualReps ?? (s.status === 'SKIPPED' ? 0 : s.expectedReps))
      .filter(r => r !== null && r !== undefined) as number[];

    if (repCounts.length === 0) {
      return 'No reps defined';
    } else {
      const allRepsSame = repCounts.every(r => r === repCounts[0]);
      if (allRepsSame) {
        repsSummaryStr = `${repCounts.length}x${repCounts[0]}`;
      } else {
        repsSummaryStr = repCounts.join('/');
      }
    }

    const weightValues: number[] = sets
      .map(s => s.actualWeight)
      .filter(w => w !== null && w !== undefined) as number[];

    if (weightValues.length > 0) {
      const minWeight = Math.min(...weightValues);
      const maxWeight = Math.max(...weightValues);
      if (minWeight === maxWeight) {
        weightSummaryStr = `${minWeight} kg`;
      } else {
        weightSummaryStr = `${minWeight}-${maxWeight} kg`;
      }
    }

    return weightSummaryStr ? `${repsSummaryStr} @ ${weightSummaryStr}` : repsSummaryStr;
  }

  onSessionNavigated(): void {
    this.sessionNavigated.emit(this.sessionData.id);
  }

  private formatDisplayDate(date: Date | null): string | null {
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) return null;
    return date.toLocaleDateString();
  }

  private formatDisplayTime(date: Date | null): string | null {
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) return null;
    return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: 'numeric', hour12: false });
  }

  private getEarliestSetCompletionTime(exercises: SessionCardExerciseViewModel[]): Date | null {
    return this.findSetCompletionTime(exercises, (t1, t2) => !t2 || t1 < t2);
  }

  private getLatestSetCompletionTime(exercises: SessionCardExerciseViewModel[]): Date | null {
    return this.findSetCompletionTime(exercises, (t1, t2) => !t2 || t1 > t2);
  }

  private findSetCompletionTime(exercises: SessionCardExerciseViewModel[], comparator: (currentTime: Date, bestTime: Date | null) => boolean): Date | null {
    let bestTime: Date | null = null;
    if (!exercises) {
      return null;
    }

    for (const exercise of exercises) {
      if (exercise.sets) {
        for (const set of exercise.sets) {
          if (set.completedAt instanceof Date && !isNaN(set.completedAt.getTime())) {
            if (comparator(set.completedAt, bestTime)) {
              bestTime = set.completedAt;
            }
          }
        }
      }
    }

    return bestTime;
  }
}
