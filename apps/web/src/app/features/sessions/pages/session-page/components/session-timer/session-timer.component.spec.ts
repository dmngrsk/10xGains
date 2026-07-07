import { ChangeDetectorRef, NgZone, WritableSignal, signal, effect } from '@angular/core';
import { Subject, Subscription } from 'rxjs';
import { vi, describe, it, expect, beforeEach, afterEach, MockedFunction } from 'vitest';
import { ServerClockService } from '@shared/services/server-clock.service';
import { SessionTimerComponent } from './session-timer.component';

// Define a type for our augmented effect mock
interface CustomMockEffect extends MockedFunction<typeof effect> {
  trigger: (index?: number) => void;
  clearRegistry: () => void;
}

// These will be reassigned in beforeEach, but need to be accessible to the vi.mock scope.
let currentMockCdr: ChangeDetectorRef;
let currentMockNgZone: NgZone;
// Milliseconds the mock server clock runs ahead of the device clock (tunable per test).
let serverClockOffset: number;

vi.mock('@angular/core', async (importOriginal) => {
  const actualCore = await importOriginal<typeof import('@angular/core')>();
  const effectRegistry: Array<(onCleanup: (c: () => void) => void) => void> = [];

  const mockEffect = vi.fn((fn: (onCleanup: (c: () => void) => void) => void) => {
    effectRegistry.push(fn);
    return { destroy: vi.fn() };
  }) as unknown as CustomMockEffect;

  mockEffect.trigger = (index = 0) => {
    if (effectRegistry[index]) {
      effectRegistry[index](() => {});
    }
  };
  mockEffect.clearRegistry = () => {
    effectRegistry.length = 0;
  };

  return {
    ...actualCore,
    effect: mockEffect,
    untracked: vi.fn((fn) => fn()),
    inject: vi.fn((token) => {
      if (token === ChangeDetectorRef) {
        return currentMockCdr; // Return the instance from the test scope
      }
      if (token === NgZone) {
        return currentMockNgZone; // Return the instance from the test scope
      }
      if (token === ServerClockService) {
        return { now: () => Date.now() + serverClockOffset } as ServerClockService;
      }
      // Fallback for other inject calls if any (though not expected for this component)
      if (actualCore.inject) {
        return actualCore.inject(token);
      }
      return undefined;
    }),
  };
});

// Test-specific subclass
class TestableSessionTimerComponent extends SessionTimerComponent {
  constructor() {
    super(); // This will now use the mocked inject that returns our test instances
  }
  // Public getters for private properties using bracket notation
  public get testIsPulsing(): boolean { return this['isPulsing']; }
  public get testCurrentTimestamp(): number | null { return this['currentTimestamp']; }
  public get testTimerSubscription(): Subscription | undefined { return this['timerSubscription']; }
  public get testDestroy$(): Subject<void> { return this['destroy$']; }
  public get testPulseTimeoutId(): ReturnType<typeof setTimeout> | null { return this['pulseTimeoutId']; }

  // Public wrappers for private methods using bracket notation
  public callTriggerPulse(): void { this['triggerPulse'](); }
  public callStopTimer(): void { this['stopTimer'](); }
}

describe('SessionTimerComponent', () => {
  let component: TestableSessionTimerComponent;
  let mockStartTimestamp: WritableSignal<number | null>;
  let spiedEffect: CustomMockEffect;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2023-01-01T00:00:00Z'));
    serverClockOffset = 0;
    spiedEffect = vi.mocked(effect) as CustomMockEffect;
    spiedEffect.clearRegistry();

    currentMockCdr = { markForCheck: vi.fn() } as unknown as ChangeDetectorRef;
    currentMockNgZone = {
      run: vi.fn((fn) => fn()),
      runOutsideAngular: vi.fn((fn) => fn()),
    } as unknown as NgZone;

    mockStartTimestamp = signal<number | null>(null);
    component = new TestableSessionTimerComponent();

    component.startTimestamp = mockStartTimestamp;

    // Manually trigger the effect for the first time AFTER inputs are set.
    // This simulates Angular's lifecycle where effects run after input binding.
    triggerEffectManually();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.restoreAllMocks();
    component.ngOnDestroy();
  });

  const triggerEffectManually = () => {
    spiedEffect.trigger(0);
  };

  it('should create and initialize with default values', () => {
    expect(component).toBeTruthy();
    expect(spiedEffect).toHaveBeenCalledTimes(1);
    expect(component.allExercisesComplete).toBe(false);
    expect(component.timerText).toBe('--:--');
    expect(component.testIsPulsing).toBe(false);
    expect(component.testCurrentTimestamp).toBeNull();
  });

  describe('startTimestamp Effect', () => {
    it('should start timer and pulse when startTimestamp becomes a number', () => {
      const start = Date.now();
      mockStartTimestamp.set(start);
      triggerEffectManually();

      expect(component.testCurrentTimestamp).toBe(start);
      expect(component.testTimerSubscription).toBeDefined();
      expect(component.testIsPulsing).toBe(true);
      expect(component.timerText).toBe('00:00');
      expect(currentMockCdr.markForCheck).toHaveBeenCalled();

      vi.advanceTimersByTime(1000);
      expect(component.testIsPulsing).toBe(false);
      expect(component.timerText).toBe('00:01');
    });

    it('should derive elapsed time from the timestamp, not a local counter', () => {
      const start = Date.now();
      mockStartTimestamp.set(start);
      triggerEffectManually();

      // Advance far beyond a single tick: the display reflects wall-clock elapsed time,
      // even if intermediate ticks were "missed" (e.g. an app freeze).
      vi.advanceTimersByTime(90 * 1000);
      expect(component.timerText).toBe('01:30');
    });

    it('should show elapsed time immediately for an already-set timestamp without pulsing', () => {
      spiedEffect.clearRegistry();
      const start = Date.now() - 5000;
      const loadedSignal = signal<number | null>(start);
      const loaded = new TestableSessionTimerComponent();
      loaded.startTimestamp = loadedSignal;

      spiedEffect.trigger(0);

      expect(loaded.testCurrentTimestamp).toBe(start);
      expect(loaded.testTimerSubscription).toBeDefined();
      expect(loaded.testIsPulsing).toBe(false);
      expect(loaded.timerText).toBe('00:05');

      loaded.ngOnDestroy();
    });

    it('should not pulse when a past timestamp arrives after the initial null (returning to a session)', () => {
      // beforeEach already ran the effect once with null (session still loading), then real
      // session data arrives carrying an older completion timestamp.
      mockStartTimestamp.set(Date.now() - 30000);
      triggerEffectManually();

      expect(component.testCurrentTimestamp).toBe(Date.now() - 30000);
      expect(component.testTimerSubscription).toBeDefined();
      expect(component.testIsPulsing).toBe(false);
      expect(component.timerText).toBe('00:30');
    });

    it('should reset and stop timer when startTimestamp becomes null after being a number', () => {
      mockStartTimestamp.set(Date.now());
      triggerEffectManually();
      vi.advanceTimersByTime(2000);
      expect(component.timerText).toBe('00:02');

      mockStartTimestamp.set(null);
      triggerEffectManually();

      expect(component.testCurrentTimestamp).toBeNull();
      expect(component.testTimerSubscription).toBeUndefined();
      expect(component.timerText).toBe('--:--');
      expect(currentMockCdr.markForCheck).toHaveBeenCalled();
    });

    it('should re-pulse and re-anchor when the timestamp changes to a newer value', () => {
      const start = Date.now();
      mockStartTimestamp.set(start);
      triggerEffectManually();
      vi.advanceTimersByTime(5000);
      expect(component.timerText).toBe('00:05');

      const newStart = Date.now();
      mockStartTimestamp.set(newStart);
      triggerEffectManually();

      expect(component.testCurrentTimestamp).toBe(newStart);
      expect(component.testIsPulsing).toBe(true);
      expect(component.timerText).toBe('00:00');
    });

    it('should re-anchor without pulsing when the timestamp reverts to an older value (set reset)', () => {
      const start = Date.now();
      mockStartTimestamp.set(start);
      triggerEffectManually();
      vi.advanceTimersByTime(5000);
      expect(component.testIsPulsing).toBe(false);

      // Reverting to an earlier completion (e.g. unchecking the latest set) must not pulse.
      const olderStart = start - 60_000;
      mockStartTimestamp.set(olderStart);
      triggerEffectManually();

      expect(component.testCurrentTimestamp).toBe(olderStart);
      expect(component.testIsPulsing).toBe(false);
      expect(component.timerText).toBe('01:05');
    });

    it('should remain reset if startTimestamp is initially null', () => {
      triggerEffectManually();
      expect(component.testCurrentTimestamp).toBeNull();
      expect(component.testTimerSubscription).toBeUndefined();
      expect(component.timerText).toBe('--:--');
    });
  });

  describe('timerText Getter', () => {
    it('should be "--:--" when timer is not running', () => {
      expect(component.timerText).toBe('--:--');
    });

    it('should be "--:--" when allExercisesComplete is true, even if timer was running', () => {
      mockStartTimestamp.set(Date.now());
      triggerEffectManually();
      vi.advanceTimersByTime(1000);
      expect(component.timerText).toBe('00:01');

      component.allExercisesComplete = true;
      expect(component.timerText).toBe('--:--');
    });

    it('should format time correctly (0 seconds)', () => {
      mockStartTimestamp.set(Date.now());
      triggerEffectManually();
      expect(component.timerText).toBe('00:00');
    });

    it('should format time correctly (59 seconds)', () => {
      mockStartTimestamp.set(Date.now());
      triggerEffectManually();
      vi.advanceTimersByTime(59 * 1000);
      expect(component.timerText).toBe('00:59');
    });

    it('should format time correctly (1 minute)', () => {
      mockStartTimestamp.set(Date.now());
      triggerEffectManually();
      vi.advanceTimersByTime(60 * 1000);
      expect(component.timerText).toBe('01:00');
    });

    it('should format time correctly (2 minutes and 5 seconds)', () => {
      mockStartTimestamp.set(Date.now());
      triggerEffectManually();
      vi.advanceTimersByTime(2 * 60 * 1000 + 5 * 1000);
      expect(component.timerText).toBe('02:05');
    });

    it('should format time correctly (100 minutes and 10 seconds)', () => {
      mockStartTimestamp.set(Date.now());
      triggerEffectManually();
      vi.advanceTimersByTime(100 * 60 * 1000 + 10 * 1000);
      expect(component.timerText).toBe('100:10');
    });
  });

  describe('allExercisesComplete Input', () => {
    it('should show "--:--" when true and revert when false while timer is active', () => {
      mockStartTimestamp.set(Date.now());
      triggerEffectManually();
      vi.advanceTimersByTime(1000);
      expect(component.timerText).toBe('00:01');

      component.allExercisesComplete = true;
      expect(component.timerText).toBe('--:--');

      component.allExercisesComplete = false;
      expect(component.timerText).toBe('00:01');
    });
  });

  it('onCompleteSession should emit sessionCompleted event', () => {
    const spy = vi.spyOn(component.sessionCompleted, 'emit');
    component.onCompleteSession();
    expect(spy).toHaveBeenCalledOnce();
  });

  describe('triggerPulse Method (via callTriggerPulse)', () => {
    it('isPulsing should be true then false after 1s', () => {
      (currentMockCdr.markForCheck as MockedFunction<() => void>).mockClear();
      component.callTriggerPulse();
      expect(component.testIsPulsing).toBe(true);
      // callTriggerPulse calls markForCheck once when setting isPulsing to true
      expect(currentMockCdr.markForCheck).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(1000); // setTimeout in triggerPulse fires
      // setTimeout callback calls markForCheck once when setting isPulsing to false
      expect(component.testIsPulsing).toBe(false);
      expect(currentMockCdr.markForCheck).toHaveBeenCalledTimes(2);
    });

    it('should clear existing pulse timeout if called again', () => {
      component.callTriggerPulse();
      expect(component.testIsPulsing).toBe(true);
      vi.advanceTimersByTime(500);
      component.callTriggerPulse();
      expect(component.testIsPulsing).toBe(true);

      vi.advanceTimersByTime(500);
      expect(component.testIsPulsing).toBe(true);

      vi.advanceTimersByTime(500);
      expect(component.testIsPulsing).toBe(false);
    });
  });

  describe('Timer Mechanics', () => {
    it('startTimer should keep the display advancing with wall-clock time', () => {
      mockStartTimestamp.set(Date.now());
      triggerEffectManually();
      expect(component.timerText).toBe('00:00');
      vi.advanceTimersByTime(1000);
      expect(component.timerText).toBe('00:01');
      vi.advanceTimersByTime(1000);
      expect(component.timerText).toBe('00:02');
    });

    it('stopTimer should stop the display from advancing', () => {
      mockStartTimestamp.set(Date.now());
      triggerEffectManually();
      vi.advanceTimersByTime(2000);
      expect(component.timerText).toBe('00:02');

      component.callStopTimer();
      expect(component.testCurrentTimestamp).toBeNull();
      expect(component.testTimerSubscription).toBeUndefined();
      vi.advanceTimersByTime(3000);
      expect(component.timerText).toBe('--:--');
    });
  });

  describe('Server clock skew', () => {
    it('should measure elapsed time against the server clock, not the device clock', () => {
      // Device clock trails the server by 3s; the timestamp is server-generated.
      serverClockOffset = 3000;
      mockStartTimestamp.set(Date.now() + 3000);
      triggerEffectManually();

      // Without offset correction this would clamp to 00:00 for the first 3 seconds.
      expect(component.timerText).toBe('00:00');
      vi.advanceTimersByTime(1000);
      expect(component.timerText).toBe('00:01');
      vi.advanceTimersByTime(1000);
      expect(component.timerText).toBe('00:02');
    });
  });

  describe('Tick alignment', () => {
    it('should fire the first tick at the next whole second rather than a full second later', () => {
      // Loaded session (initial value already set) so no pulse timeout competes for markForCheck.
      spiedEffect.clearRegistry();
      const aligned = new TestableSessionTimerComponent();
      aligned.startTimestamp = signal<number | null>(Date.now() - 4500);
      spiedEffect.trigger(0);

      expect(aligned.timerText).toBe('00:04');
      (currentMockCdr.markForCheck as MockedFunction<() => void>).mockClear();

      vi.advanceTimersByTime(499);
      expect(currentMockCdr.markForCheck).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1); // 500ms in: the elapsed time crosses the 5s boundary
      expect(currentMockCdr.markForCheck).toHaveBeenCalledTimes(1);
      expect(aligned.timerText).toBe('00:05');

      vi.advanceTimersByTime(1000); // subsequent ticks stay a second apart
      expect(currentMockCdr.markForCheck).toHaveBeenCalledTimes(2);

      aligned.ngOnDestroy();
    });
  });

  describe('ngOnDestroy', () => {
    it('should complete destroy$ subject', () => {
      const destroyNextSpy = vi.spyOn(component.testDestroy$, 'next');
      const destroyCompleteSpy = vi.spyOn(component.testDestroy$, 'complete');
      component.ngOnDestroy();
      expect(destroyNextSpy).toHaveBeenCalledOnce();
      expect(destroyCompleteSpy).toHaveBeenCalledOnce();
    });

    it('should effectively stop the timer', () => {
      mockStartTimestamp.set(Date.now());
      triggerEffectManually();
      vi.advanceTimersByTime(1000);
      expect(component.timerText).toBe('00:01');

      component.ngOnDestroy();

      expect(component.testTimerSubscription).toBeUndefined();
      expect(component.timerText).toBe('--:--');
    });

    it('should clear pulseTimeoutId if it exists', () => {
      component.callTriggerPulse();
      expect(component.testPulseTimeoutId).not.toBeNull();
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');
      const initialPulseTimeoutId = component.testPulseTimeoutId;

      component.ngOnDestroy();
      expect(clearTimeoutSpy).toHaveBeenCalledWith(initialPulseTimeoutId);
      expect(component.testPulseTimeoutId).toBeNull();
    });
  });
});
