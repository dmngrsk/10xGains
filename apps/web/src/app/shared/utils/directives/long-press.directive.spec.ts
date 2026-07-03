import { Component, DebugElement, NgZone } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LongPressDirective } from './long-press.directive';

if (typeof PointerEvent === 'undefined') {
  // @ts-expect-error - this is a mock for the Node.js environment
  global.PointerEvent = class PointerEvent extends Event {
    clientX: number;
    clientY: number;
    button: number;

    constructor(type: string, params: PointerEventInit = {}) {
      super(type, params);
      this.clientX = params.clientX ?? 0;
      this.clientY = params.clientY ?? 0;
      this.button = params.button ?? 0;
    }
  };
}

const DEFAULT_DURATION = 500;
const DEFAULT_MOVEMENT_THRESHOLD = 10;

@Component({
  template: `
    <div
      txgLongPress
      [txgLongPressDuration]="duration"
      [txgLongPressMovementThreshold]="movementThreshold"
      [txgLongPressDisabled]="disabled"
      (txgLongPress)="onLongPress($event)"
      (txgClick)="onClick($event)">
      style="width: 100px; height: 100px; background-color: lightgray;"
    </div>
  `,
  standalone: true,
  imports: [LongPressDirective],
})
class TestHostComponent {
  duration: number = DEFAULT_DURATION;
  movementThreshold: number = DEFAULT_MOVEMENT_THRESHOLD;
  disabled: boolean = false;

  longPressEvent: PointerEvent | null = null;
  clickEvent: PointerEvent | null = null;

  onLongPress(event: PointerEvent) {
    this.longPressEvent = event;
  }

  onClick(event: PointerEvent) {
    this.clickEvent = event;
  }

  resetEvents() {
    this.longPressEvent = null;
    this.clickEvent = null;
  }
}

describe('LongPressDirective', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let component: TestHostComponent;
  let directiveElement: DebugElement;
  let ngZone: NgZone;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [LongPressDirective, TestHostComponent],
    });
    fixture = TestBed.createComponent(TestHostComponent);
    component = fixture.componentInstance;
    directiveElement = fixture.debugElement.query(By.directive(LongPressDirective));
    ngZone = TestBed.inject(NgZone);
    fixture.detectChanges();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function createPointerEvent(type: string, x: number, y: number, button: number = 0): PointerEvent {
    return new PointerEvent(type, { clientX: x, clientY: y, button });
  }

  function dispatchPointerDown(el: DebugElement, x = 0, y = 0, button = 0) {
    el.triggerEventHandler('pointerdown', createPointerEvent('pointerdown', x, y, button));
  }

  function dispatchPointerMove(el: DebugElement, x = 0, y = 0, button = 0) {
    el.triggerEventHandler('pointermove', createPointerEvent('pointermove', x, y, button));
  }

  function dispatchPointerUp(el: DebugElement, x = 0, y = 0, button = 0) {
    el.triggerEventHandler('pointerup', createPointerEvent('pointerup', x, y, button));
  }

  function dispatchPointerLeave(el: DebugElement) {
    el.triggerEventHandler('pointerleave', createPointerEvent('pointerleave', 0, 0));
  }

  it('should create an instance', () => {
    const directive = directiveElement.injector.get(LongPressDirective);
    expect(directive).toBeTruthy();
  });

  it('should use default duration and threshold if not provided', () => {
    const directive = directiveElement.injector.get(LongPressDirective);
    expect(directive.txgLongPressDuration).toBe(DEFAULT_DURATION);
    expect(directive.txgLongPressMovementThreshold).toBe(DEFAULT_MOVEMENT_THRESHOLD);
  });

  it('should use provided duration and threshold', () => {
    component.duration = 300;
    component.movementThreshold = 5;
    fixture.detectChanges();
    const directive = directiveElement.injector.get(LongPressDirective);
    expect(directive.txgLongPressDuration).toBe(300);
    expect(directive.txgLongPressMovementThreshold).toBe(5);
  });

  describe('Tap (txgClick output)', () => {
    it('should emit txgClick on a short press and release without movement', () => {
      dispatchPointerDown(directiveElement, 10, 10);
      vi.advanceTimersByTime(component.duration - 100);
      dispatchPointerUp(directiveElement, 10, 10);

      expect(component.clickEvent).not.toBeNull();
      expect(component.clickEvent?.clientX).toBe(10);
      expect(component.longPressEvent).toBeNull();
      vi.advanceTimersByTime(component.duration);
      expect(component.longPressEvent).toBeNull();
    });

    it('should NOT emit txgClick if movement exceeds threshold', () => {
      dispatchPointerDown(directiveElement, 10, 10);
      vi.advanceTimersByTime(100);
      dispatchPointerMove(directiveElement, 10 + component.movementThreshold + 1, 10);
      vi.advanceTimersByTime(100);
      dispatchPointerUp(directiveElement, 10 + component.movementThreshold + 1, 10);

      expect(component.clickEvent).toBeNull();
      expect(component.longPressEvent).toBeNull();
    });

    it('should NOT emit txgClick if txgLongPressDisabled is true', () => {
      component.disabled = true;
      fixture.detectChanges();

      dispatchPointerDown(directiveElement, 10, 10);
      vi.advanceTimersByTime(component.duration - 100);
      dispatchPointerUp(directiveElement, 10, 10);

      expect(component.clickEvent).toBeNull();
      expect(component.longPressEvent).toBeNull();
    });

    it('should NOT emit txgClick if it was a long press', () => {
      dispatchPointerDown(directiveElement, 10, 10);
      vi.advanceTimersByTime(component.duration + 50);
      dispatchPointerUp(directiveElement, 10, 10);

      expect(component.longPressEvent).not.toBeNull();
      expect(component.clickEvent).toBeNull();
    });

    it('should NOT emit txgClick for non-primary mouse buttons', () => {
      dispatchPointerDown(directiveElement, 10, 10, 1);
      vi.advanceTimersByTime(component.duration - 100);
      dispatchPointerUp(directiveElement, 10, 10, 1);

      expect(component.clickEvent).toBeNull();
      expect(component.longPressEvent).toBeNull();
    });
  });

  describe('Long Press (txgLongPress output)', () => {
    it('should emit txgLongPress after duration if pointer is held down without movement', () => {
      dispatchPointerDown(directiveElement, 10, 10);
      vi.advanceTimersByTime(component.duration + 50);

      expect(component.longPressEvent).not.toBeNull();
      expect(component.longPressEvent?.clientX).toBe(10);
      expect(component.clickEvent).toBeNull();

      dispatchPointerUp(directiveElement, 10, 10);
      expect(component.clickEvent).toBeNull();
    });

    it('should NOT emit txgLongPress if pointer is released before duration', () => {
      dispatchPointerDown(directiveElement, 10, 10);
      vi.advanceTimersByTime(component.duration - 100);
      dispatchPointerUp(directiveElement, 10, 10);

      expect(component.longPressEvent).toBeNull();
      expect(component.clickEvent).not.toBeNull();
    });

    it('should NOT emit txgLongPress if movement exceeds threshold during the press', () => {
      dispatchPointerDown(directiveElement, 10, 10);
      vi.advanceTimersByTime(component.duration / 2);
      dispatchPointerMove(directiveElement, 10 + component.movementThreshold + 1, 10);
      vi.advanceTimersByTime(component.duration);

      expect(component.longPressEvent).toBeNull();
      expect(component.clickEvent).toBeNull();

      dispatchPointerUp(directiveElement, 10 + component.movementThreshold + 1, 10);
      expect(component.clickEvent).toBeNull();
    });

    it('should NOT emit txgLongPress if txgLongPressDisabled is true', () => {
      component.disabled = true;
      fixture.detectChanges();

      dispatchPointerDown(directiveElement, 10, 10);
      vi.advanceTimersByTime(component.duration + 50);
      dispatchPointerUp(directiveElement, 10, 10);

      expect(component.longPressEvent).toBeNull();
      expect(component.clickEvent).toBeNull();
    });

    it('should NOT emit txgLongPress for non-primary mouse buttons', () => {
      dispatchPointerDown(directiveElement, 10, 10, 1);
      vi.advanceTimersByTime(component.duration + 50);
      dispatchPointerUp(directiveElement, 10, 10, 1);

      expect(component.longPressEvent).toBeNull();
      expect(component.clickEvent).toBeNull();
    });
  });

  describe('Cancellation by Pointer Leave', () => {
    it('should cancel long press and tap if pointer leaves during press', () => {
      dispatchPointerDown(directiveElement, 10, 10);
      vi.advanceTimersByTime(component.duration / 2);
      dispatchPointerLeave(directiveElement);
      vi.advanceTimersByTime(component.duration);

      expect(component.longPressEvent).toBeNull();
      expect(component.clickEvent).toBeNull();

      dispatchPointerUp(directiveElement, 10, 10);
      expect(component.longPressEvent).toBeNull();
      expect(component.clickEvent).toBeNull();
    });
  });

  describe('NgZone interaction', () => {
    it('should run setTimeout outside NgZone and emit events inside NgZone', () => {
      const runOutsideAngularSpy = vi.spyOn(ngZone, 'runOutsideAngular');
      const runSpy = vi.spyOn(ngZone, 'run');

      dispatchPointerDown(directiveElement, 10, 10);
      expect(runOutsideAngularSpy).toHaveBeenCalled();

      vi.advanceTimersByTime(component.duration + 50);
      expect(component.longPressEvent).not.toBeNull();
      expect(runSpy).toHaveBeenCalled();

      runOutsideAngularSpy.mockClear();
      runSpy.mockClear();
      component.resetEvents();

      dispatchPointerDown(directiveElement, 20, 20);
      expect(runOutsideAngularSpy).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(100);
      dispatchPointerUp(directiveElement, 20, 20);
      expect(component.clickEvent).not.toBeNull();

      expect(runSpy).not.toHaveBeenCalled();
    });
  });

  describe('ngOnDestroy', () => {
    it('should clear timeout on destroy', () => {
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

      dispatchPointerDown(directiveElement, 10, 10);
      vi.advanceTimersByTime(component.duration / 2);

      fixture.destroy();

      expect(clearTimeoutSpy).toHaveBeenCalled();
      vi.advanceTimersByTime(component.duration);
      expect(component.longPressEvent).toBeNull();
      expect(component.clickEvent).toBeNull();
    });
  });
});
