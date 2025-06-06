import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input, Output, EventEmitter } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { SessionCardViewModel, SessionCardSetViewModel } from '../../models/session-card.viewmodel';

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
  @Output() sessionAbandoned = new EventEmitter<string>();

  get buttonText(): string {
    if (!this.sessionData) return '';

    switch (this.sessionData.status) {
      case 'PENDING':
        return 'Start Session';
      case 'IN_PROGRESS':
        return 'Continue Session';
      case 'COMPLETED':
      case 'CANCELLED':
        return 'View Session';
      default:
        return '';
    }
  }

  get sessionDateTimeText(): string {
    if (!this.sessionData) return '';

    const displayDate = this.formatDisplayDate(this.sessionData.sessionDate);
    if (!displayDate) return '';

    const sessionTimestamps = [this.sessionData.sessionDate]
      .concat(this.sessionData.exercises.flatMap(e => e.sets.map(s => s.completedAt)))
      .filter(d => !!d && d instanceof Date);

    switch (this.sessionData.status) {
      case 'PENDING': {
        return displayDate;
      }

      case 'IN_PROGRESS': {
        const sessionStartTime = sessionTimestamps.sort((a, b) => a.getTime() - b.getTime())[0];
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
        const sessionStartTime = sessionTimestamps.sort((a, b) => a.getTime() - b.getTime())[0];
        const sessionEndTime = sessionTimestamps.sort((a, b) => b.getTime() - a.getTime())[0];

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

  get isAbandonableSession(): boolean {
    if (!this.sessionData.sessionDate) return false;
    return this.isActiveSession && (new Date().getTime() - this.sessionData.sessionDate.getTime()) > 1000 * 60 * 60 * 6; // 6h
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

  onSessionAbandoned(): void {
    this.sessionAbandoned.emit(this.sessionData.id);
  }

  private formatDisplayDate(date: Date | null): string | null {
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) return null;
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
  }

  private formatDisplayTime(date: Date | null): string | null {
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) return null;
    return new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }).format(date);
  }
}
