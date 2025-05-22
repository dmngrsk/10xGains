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
  @Input({ required: true }) resetTrigger!: Signal<number | null>;
  @Input() @HostBinding('class.all-sets-complete-highlight') allExercisesComplete: boolean = false;

  @Output() readonly sessionCompleted = new EventEmitter<void>();

  @HostBinding('class.pulsing') private isPulsing = false;

  private readonly cdr = inject(ChangeDetectorRef);
  private readonly ngZone = inject(NgZone);
  private readonly destroy$ = new Subject<void>();
  private pulseTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private secondsElapsed: number = 0;
  private timerSubscription: Subscription | undefined;

  get timerText(): string {
    if (this.timerSubscription === undefined || this.allExercisesComplete) {
      return '--:--';
    }

    const minutes = Math.floor(this.secondsElapsed / 60);
    const seconds = this.secondsElapsed % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  constructor() {
    effect(() => {
      const triggerValue = this.resetTrigger();
      if (triggerValue === null) {
        untracked(() => {
          this.resetTimer();
        });
      } else {
        untracked(() => {
          this.resetTimer();
          this.startTimer();
          this.triggerPulse();
        });
      }
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

  onCompleteSessionClick(): void {
    this.sessionCompleted.emit();
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
    this.ngZone.runOutsideAngular(() => {
      this.timerSubscription?.unsubscribe();
      this.timerSubscription = interval(1000)
        .pipe(takeUntil(this.destroy$))
        .subscribe(() => {
          this.ngZone.run(() => {
            this.secondsElapsed++;
            this.cdr.markForCheck();
          });
        });
    });
  }

  private stopTimer(): void {
    this.timerSubscription?.unsubscribe();
    this.timerSubscription = undefined;
  }

  private resetTimer(): void {
    this.secondsElapsed = 0;
    this.stopTimer();
    this.cdr.markForCheck();
  }
}
