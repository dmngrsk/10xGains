import { ChangeDetectorRef, NgZone, WritableSignal, signal, effect } from '@angular/core';
import { Subject, Subscription } from 'rxjs';
import { vi, describe, it, expect, beforeEach, afterEach, MockedFunction } from 'vitest';
import { SessionTimerComponent } from './session-timer.component';

// Define a type for our augmented effect mock
interface CustomMockEffect extends MockedFunction<typeof effect> {
  trigger: (index?: number) => void;
  clearRegistry: () => void;
}

// These will be reassigned in beforeEach, but need to be accessible to the vi.mock scope.
let currentMockCdr: ChangeDetectorRef;
let currentMockNgZone: NgZone;

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
  public get testSecondsElapsed(): number { return this['secondsElapsed']; }
  public set testSecondsElapsed(value: number) { this['secondsElapsed'] = value; }
  public get testTimerSubscription(): Subscription | undefined { return this['timerSubscription']; }
  public get testDestroy$(): Subject<void> { return this['destroy$']; }
  public get testPulseTimeoutId(): ReturnType<typeof setTimeout> | null { return this['pulseTimeoutId']; }

  // Public wrappers for private methods using bracket notation
  public callTriggerPulse(): void { this['triggerPulse'](); }
  public callStopTimer(): void { this['stopTimer'](); }
  public callResetTimer(): void { this['resetTimer'](); }
}

describe('SessionTimerComponent', () => {
  let component: TestableSessionTimerComponent;
  let mockResetTrigger: WritableSignal<number | null>;
  let spiedEffect: CustomMockEffect;

  beforeEach(() => {
    vi.useFakeTimers();
    spiedEffect = vi.mocked(effect) as CustomMockEffect;
    spiedEffect.clearRegistry();

    currentMockCdr = { markForCheck: vi.fn() } as unknown as ChangeDetectorRef;
    currentMockNgZone = {
      run: vi.fn((fn) => fn()),
      runOutsideAngular: vi.fn((fn) => fn()),
    } as unknown as NgZone;

    mockResetTrigger = signal<number | null>(null);
    component = new TestableSessionTimerComponent();

    component.resetTrigger = mockResetTrigger;

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
  });

  describe('resetTrigger Effect', () => {
    it('should start timer and pulse when resetTrigger emits a number', () => {
      const resetTime = Date.now();
      mockResetTrigger.set(resetTime);
      triggerEffectManually();
      vi.advanceTimersByTime(0);

      expect(component.testSecondsElapsed).toBe(0);
      expect(component.testTimerSubscription).toBeDefined();
      expect(component.testIsPulsing).toBe(true);
      expect(currentMockCdr.markForCheck).toHaveBeenCalled();

      vi.advanceTimersByTime(1000);
      expect(component.testIsPulsing).toBe(false);
      expect(component.testSecondsElapsed).toBe(1);
      expect(component.timerText).toBe('00:01');
    });

    it('should reset and stop timer when resetTrigger emits null after being a number', () => {
      mockResetTrigger.set(Date.now());
      triggerEffectManually();
      vi.advanceTimersByTime(2000);
      expect(component.testSecondsElapsed).toBe(2);

      mockResetTrigger.set(null);
      triggerEffectManually();
      vi.advanceTimersByTime(0);

      expect(component.testSecondsElapsed).toBe(0);
      expect(component.testTimerSubscription).toBeUndefined();
      expect(component.timerText).toBe('--:--');
      expect(currentMockCdr.markForCheck).toHaveBeenCalled();
    });

    it('should remain reset if resetTrigger is initially null', () => {
      triggerEffectManually();
      vi.advanceTimersByTime(0);
      expect(component.testSecondsElapsed).toBe(0);
      expect(component.testTimerSubscription).toBeUndefined();
      expect(component.timerText).toBe('--:--');
    });
  });

  describe('timerText Getter', () => {
    it('should be "--:--" when timer is not running', () => {
      expect(component.timerText).toBe('--:--');
    });

    it('should be "--:--" when allExercisesComplete is true, even if timer was running', () => {
      mockResetTrigger.set(Date.now());
      triggerEffectManually();
      vi.advanceTimersByTime(1000);
      expect(component.timerText).toBe('00:01');

      component.allExercisesComplete = true;
      triggerEffectManually();
      expect(component.timerText).toBe('--:--');
    });

    it('should format time correctly (0 seconds)', () => {
      mockResetTrigger.set(Date.now());
      triggerEffectManually();
      vi.advanceTimersByTime(0);
      expect(component.timerText).toBe('00:00');
    });

    it('should format time correctly (59 seconds)', () => {
      mockResetTrigger.set(Date.now());
      triggerEffectManually();
      vi.advanceTimersByTime(59 * 1000);
      expect(component.timerText).toBe('00:59');
    });

    it('should format time correctly (1 minute)', () => {
      mockResetTrigger.set(Date.now());
      triggerEffectManually();
      vi.advanceTimersByTime(60 * 1000);
      expect(component.timerText).toBe('01:00');
    });

    it('should format time correctly (2 minutes and 5 seconds)', () => {
      mockResetTrigger.set(Date.now());
      triggerEffectManually();
      vi.advanceTimersByTime(2 * 60 * 1000 + 5 * 1000);
      expect(component.timerText).toBe('02:05');
    });

    it('should format time correctly (100 minutes and 10 seconds)', () => {
      mockResetTrigger.set(Date.now());
      triggerEffectManually();
      vi.advanceTimersByTime(100 * 60 * 1000 + 10 * 1000);
      expect(component.timerText).toBe('100:10');
    });
  });

  describe('allExercisesComplete Input', () => {
    it('should update timerText to "--:--" when true and timer is active', () => {
      (currentMockCdr.markForCheck as MockedFunction<() => void>).mockClear();
      mockResetTrigger.set(Date.now());
      triggerEffectManually(); // Effect runs: resetTimer (MFC#1), startTimer, triggerPulse (MFC#2)
      expect(currentMockCdr.markForCheck).toHaveBeenCalledTimes(2);

      vi.advanceTimersByTime(1000); // Interval (MFC#3), Pulse timeout (MFC#4). secondsElapsed = 1.
      expect(currentMockCdr.markForCheck).toHaveBeenCalledTimes(4);
      expect(component.timerText).toBe('00:01'); // Verify pre-condition

      (currentMockCdr.markForCheck as MockedFunction<() => void>).mockClear();
      component.allExercisesComplete = true;
      // No triggerEffectManually(). secondsElapsed is still 1.
      // timerText getter will now return '--:--'. No new markForCheck calls.
      expect(component.timerText).toBe('--:--');
      expect(currentMockCdr.markForCheck).not.toHaveBeenCalled();
    });

    it('should revert timerText when false and timer is active', () => {
      (currentMockCdr.markForCheck as MockedFunction<() => void>).mockClear();
      mockResetTrigger.set(Date.now());
      triggerEffectManually(); // Effect runs: resetTimer (MFC#1), startTimer, triggerPulse (MFC#2)
      expect(currentMockCdr.markForCheck).toHaveBeenCalledTimes(2);

      vi.advanceTimersByTime(1000); // Interval (MFC#3), Pulse timeout (MFC#4). secondsElapsed = 1.
      expect(currentMockCdr.markForCheck).toHaveBeenCalledTimes(4);
      // At this point, component.timerText is '00:01'.

      (currentMockCdr.markForCheck as MockedFunction<() => void>).mockClear();
      component.allExercisesComplete = true;
      // No triggerEffectManually(). secondsElapsed is still 1.
      // timerText getter returns '--:--'. No new markForCheck calls.
      expect(component.timerText).toBe('--:--');
      expect(currentMockCdr.markForCheck).not.toHaveBeenCalled();

      // component.allExercisesComplete is still true from the previous step.
      // No need to clear mockCdr again as we still expect no calls.
      component.allExercisesComplete = false;
      // No triggerEffectManually(). secondsElapsed is still 1.
      // timerText getter returns '00:01'. No new markForCheck calls.
      expect(component.timerText).toBe('00:01'); // This should now pass.
      expect(currentMockCdr.markForCheck).not.toHaveBeenCalled();
    });
  });

  it('onCompleteSession should emit sessionCompleted event', () => {
    const spy = vi.spyOn(component.sessionCompleted, 'emit');
    component.onCompleteSession();
    expect(spy).toHaveBeenCalledOnce();
  });

  describe('triggerPulse Method (via callTriggerPulse)', () => {
    it('isPulsing should be true then false after 1s', () => {
      // Defensive cleanup specific to this test to ensure no prior timer is running.
      // This helps isolate whether an old interval from another test is firing.
      if (component.testTimerSubscription) {
        component.callStopTimer();
      }
      // Ensure secondsElapsed is also reset if we are defensively stopping a timer,
      // as this test doesn't expect timer activity otherwise.
      component.testSecondsElapsed = 0;

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
    it('startTimer should increment secondsElapsed', () => {
      mockResetTrigger.set(Date.now());
      triggerEffectManually();
      vi.advanceTimersByTime(0);
      expect(component.testSecondsElapsed).toBe(0);
      vi.advanceTimersByTime(1000);
      expect(component.testSecondsElapsed).toBe(1);
      vi.advanceTimersByTime(1000);
      expect(component.testSecondsElapsed).toBe(2);
    });

    it('stopTimer should stop incrementing secondsElapsed', () => {
      mockResetTrigger.set(Date.now());
      triggerEffectManually();
      vi.advanceTimersByTime(2000);
      expect(component.testSecondsElapsed).toBe(2);

      component.callStopTimer();
      vi.advanceTimersByTime(3000);
      expect(component.testSecondsElapsed).toBe(2);
    });

    it('resetTimer should set secondsElapsed to 0 and stop timer', () => {
      mockResetTrigger.set(Date.now());
      triggerEffectManually();
      vi.advanceTimersByTime(3000);
      expect(component.testSecondsElapsed).toBe(3);

      component.callResetTimer();
      expect(component.testSecondsElapsed).toBe(0);
      expect(component.testTimerSubscription).toBeUndefined();
      vi.advanceTimersByTime(2000);
      expect(component.testSecondsElapsed).toBe(0);
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

    it('should effectively stop the timer', () => { // Renamed test for clarity
      mockResetTrigger.set(Date.now());
      triggerEffectManually();
      vi.advanceTimersByTime(1000);
      expect(component.testSecondsElapsed).toBe(1);

      component.ngOnDestroy();

      vi.advanceTimersByTime(1000);
      expect(component.testSecondsElapsed).toBe(1);
      expect(component.testTimerSubscription).toBeUndefined();
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
