import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input, OnDestroy, inject, NgZone, ChangeDetectorRef, Output, EventEmitter, HostBinding, effect, untracked, Signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { Subscription, Subject, takeUntil, timer } from 'rxjs';
import { ServerClockService } from '@shared/services/server-clock.service';

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

  // A newly anchored timestamp only pulses when it represents a completion that just happened;
  // anything older (e.g. loading a session that already has completed sets) must not pulse.
  private static readonly PULSE_ELAPSED_THRESHOLD_MS = 1000;

  private readonly cdr = inject(ChangeDetectorRef);
  private readonly ngZone = inject(NgZone);
  private readonly serverClock = inject(ServerClockService);
  private readonly destroy$ = new Subject<void>();
  private pulseTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private currentTimestamp: number | null = null;
  private timerSubscription: Subscription | undefined;

  get timerText(): string {
    if (this.currentTimestamp === null || this.allExercisesComplete) {
      return '--:--';
    }

    const secondsElapsed = Math.max(0, Math.floor((this.serverClock.now() - this.currentTimestamp) / 1000));
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
    if (timestamp === null) {
      this.stopTimer();
      return;
    }

    // A just-happened completion pulses; an anchor seeded from an older completion (e.g. loading
    // a session that already has completed sets) does not.
    const isNewCompletion = (this.serverClock.now() - timestamp) < SessionTimerComponent.PULSE_ELAPSED_THRESHOLD_MS;

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
    this.timerSubscription?.unsubscribe();

    this.ngZone.runOutsideAngular(() => {
      this.timerSubscription = timer(this.delayToNextSecond(), 1000)
        .pipe(takeUntil(this.destroy$))
        .subscribe(() => {
          this.ngZone.run(() => {
            this.cdr.markForCheck();
          });
        });
    });
  }

  private delayToNextSecond(): number {
    if (this.currentTimestamp === null) {
      return 1000;
    }

    const elapsedMs = Math.max(0, this.serverClock.now() - this.currentTimestamp);
    const remainder = elapsedMs % 1000;
    return remainder === 0 ? 1000 : 1000 - remainder;
  }

  private stopTimer(): void {
    this.currentTimestamp = null;
    this.timerSubscription?.unsubscribe();
    this.timerSubscription = undefined;
    this.cdr.markForCheck();
  }
}
