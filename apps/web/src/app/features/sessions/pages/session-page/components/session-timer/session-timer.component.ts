import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input, OnDestroy, inject, NgZone, ChangeDetectorRef, Output, EventEmitter, HostBinding, effect, untracked, Signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { Subscription, Subject, takeUntil, interval } from 'rxjs';

@Component({
  selector: 'txg-session-timer',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule, MatDividerModule],
  templateUrl: './session-timer.component.html',
  styleUrls: ['./session-timer.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SessionTimerComponent implements OnDestroy {
  @Input({ required: true }) startTimestamp!: Signal<number | null | undefined>;
  @Input() @HostBinding('class.all-sets-complete-highlight') allExercisesComplete: boolean = false;

  @Output() readonly sessionCompleted = new EventEmitter<void>();

  @HostBinding('class.pulsing') protected isPulsing = false;

  private readonly cdr = inject(ChangeDetectorRef);
  private readonly ngZone = inject(NgZone);
  private readonly destroy$ = new Subject<void>();
  private pulseTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private currentTimestamp: number | null = null;
  private isInitialized: boolean = false;
  private timerSubscription: Subscription | undefined;

  get timerText(): string {
    if (this.currentTimestamp === null || this.allExercisesComplete) {
      return '--:--';
    }

    const secondsElapsed = Math.max(0, Math.floor((Date.now() - this.currentTimestamp) / 1000));
    const minutes = Math.floor(secondsElapsed / 60);
    const seconds = secondsElapsed % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  constructor() {
    effect(() => {
      const timestamp = this.startTimestamp();
      untracked(() => this.applyTimestamp(timestamp ?? null));
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.stopTimer();
    if (this.pulseTimeoutId) {
      clearTimeout(this.pulseTimeoutId);
      this.pulseTimeoutId = null;
    }
  }

  onCompleteSession(): void {
    this.sessionCompleted.emit();
  }

  private applyTimestamp(timestamp: number | null): void {
    const isNewCompletion = this.isInitialized && timestamp !== null && (this.currentTimestamp === null || timestamp > this.currentTimestamp);
    this.isInitialized = true;

    if (timestamp === null) {
      this.stopTimer();
      return;
    }

    this.currentTimestamp = timestamp;
    this.startTimer();
    this.cdr.markForCheck();

    if (isNewCompletion) {
      this.triggerPulse();
    }
  }

  private triggerPulse(): void {
    if (this.pulseTimeoutId) {
      clearTimeout(this.pulseTimeoutId);
    }

    this.isPulsing = true;
    this.cdr.markForCheck();

    this.pulseTimeoutId = setTimeout(() => {
      this.isPulsing = false;
      this.pulseTimeoutId = null;
      this.cdr.markForCheck();
    }, 1000);
  }

  private startTimer(): void {
    if (this.timerSubscription) {
      return;
    }

    this.ngZone.runOutsideAngular(() => {
      this.timerSubscription = interval(1000)
        .pipe(takeUntil(this.destroy$))
        .subscribe(() => {
          this.ngZone.run(() => {
            this.cdr.markForCheck();
          });
        });
    });
  }

  private stopTimer(): void {
    this.currentTimestamp = null;
    this.timerSubscription?.unsubscribe();
    this.timerSubscription = undefined;
    this.cdr.markForCheck();
  }
}
