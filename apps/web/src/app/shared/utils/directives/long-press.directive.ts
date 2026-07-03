import { Directive, EventEmitter, HostListener, Input, NgZone, OnDestroy, Output, inject } from '@angular/core';

const DEFAULT_LONG_PRESS_DURATION = 500; // ms
const DEFAULT_LONG_PRESS_MOVEMENT_THRESHOLD = 10; // px

/**
 * `LongPressDirective` enhances a host element with long press and tap detection.
 *
 * This directive listens to pointer events (down, move, up, leave) on the host element
 * to differentiate between a quick tap and a sustained long press.
 *
 * It allows customization of the long press duration and the movement threshold to cancel a press.
 *
 * @example
 * ```html
 * <button
 *   txgLongPress
 *   [txgLongPressDuration]="700"               // Optional: Custom duration in ms
 *   [txgLongPressDisabled]="shouldDisable"     // Optional: Disable the directive
 *   (txgLongPress)="onLongPress($event)"       // Emits when a long press is detected
 *   (txgClick)="onClick($event)"               // Emits when a tap (not a long press) is detected
 * >
 *   Press or Tap Me
 * </button>
 * ```
 */
@Directive({
  selector: '[txgLongPress]', // Attribute selector to apply the directive
  standalone: true,
})
export class LongPressDirective implements OnDestroy {
  private ngZone = inject(NgZone);

  /**
   * Duration in milliseconds to wait before a press is considered a long press.
   * Defaults to `DEFAULT_LONG_PRESS_DURATION` (500ms).
   */
  @Input() txgLongPressDuration: number = DEFAULT_LONG_PRESS_DURATION;

  /**
   * Movement threshold in pixels. If the pointer moves more than this distance
   * from the initial press position, the press (both tap and long press) is cancelled.
   * Defaults to `DEFAULT_LONG_PRESS_MOVEMENT_THRESHOLD` (10px).
   */
  @Input() txgLongPressMovementThreshold: number = DEFAULT_LONG_PRESS_MOVEMENT_THRESHOLD;

  /**
   * Disables the long press and tap detection when set to `true`.
   * Defaults to `false`.
   */
  @Input() txgLongPressDisabled: boolean = false;

  /**
   * Emits the original `PointerEvent` when a long press action is successfully detected.
   * A long press occurs if the pointer is held down for the `txgLongPressDuration`
   * without exceeding the `txgLongPressMovementThreshold`.
   */
  @Output() txgLongPress = new EventEmitter<PointerEvent>();

  /**
   * Emits the original `PointerEvent` when a tap action is successfully detected.
   * A tap occurs if the pointer is released before the `txgLongPressDuration` elapses
   * and the movement has not exceeded `txgLongPressMovementThreshold`,
   * and a long press was not triggered.
   */
  @Output() txgClick = new EventEmitter<PointerEvent>();

  private pressTimeout: ReturnType<typeof setTimeout> | null = null;
  private initialX?: number;
  private initialY?: number;
  private isPressing: boolean = false;
  private isLongPressTriggered: boolean = false;

  @HostListener('pointerdown', ['$event'])
  onPointerDown(event: PointerEvent): void {
    if (this.txgLongPressDisabled || event.button !== 0) return;

    this.isPressing = true;
    this.isLongPressTriggered = false;
    this.initialX = event.clientX;
    this.initialY = event.clientY;

    this.ngZone.runOutsideAngular(() => {
      this.pressTimeout = setTimeout(() => {
        this.ngZone.run(() => {
          if (this.isPressing) {
            this.isLongPressTriggered = true;
            this.txgLongPress.emit(event);
          }
        });
      }, this.txgLongPressDuration);
    });
  }

  @HostListener('pointermove', ['$event'])
  onPointerMove(event: PointerEvent): void {
    if (this.isPressing && this.pressTimeout && (this.initialX !== undefined && this.initialY !== undefined)) {
      const deltaX = Math.abs(event.clientX - this.initialX);
      const deltaY = Math.abs(event.clientY - this.initialY);
      if (deltaX > this.txgLongPressMovementThreshold || deltaY > this.txgLongPressMovementThreshold) {
        this.clearPressTimeout(); // Movement exceeded threshold, cancel long press timer
        // We don't set isPressing to false or resetState() here yet.
        // This allows a 'drag' to cancel the long press but still potentially be part of another gesture.
        // The tap event will also be correctly cancelled if the pointerup is outside the threshold.
      }
    }
  }

  @HostListener('pointerup', ['$event'])
  onPointerUp(event: PointerEvent): void {
    if (event.button !== 0) return;

    const wasPressing = this.isPressing;
    this.clearPressTimeout();

    if (wasPressing && !this.isLongPressTriggered && !this.txgLongPressDisabled) {
      if (this.initialX !== undefined && this.initialY !== undefined) {
        const deltaX = Math.abs(event.clientX - this.initialX);
        const deltaY = Math.abs(event.clientY - this.initialY);
        if (deltaX <= this.txgLongPressMovementThreshold && deltaY <= this.txgLongPressMovementThreshold) {
          this.txgClick.emit(event);
        }
      } else {
        // If initialX/Y is not set (should not happen if onPointerDown was called and not reset),
        // or if we want to be lenient and consider it a tap anyway if no movement check was done.
        // For safety, and to handle extremely short taps where pointermove might not fire,
        // we can emit tap if not a long press.
        // However, the previous delta check should cover most valid taps.
        // This specific else branch might be redundant if initialX/Y are always set on pointerdown.
        // For now, let's assume a tap if we got here without a long press and within bounds.
        // This was: this.txgClick.emit(event);
        // Re-evaluating: The outer `if (this.initialX !== undefined ...)` should handle all valid tap emission.
        // An `else` here means `initialX` or `initialY` was undefined, which implies an inconsistent state or
        // a press that started outside the element and ended inside, which this directive isn't designed for.
        // For robustness, only emit if we have initial coordinates to compare against.
      }
    }
    this.resetState();
  }

  @HostListener('pointerleave')
  onPointerLeave(): void {
    if (this.isPressing) {
      this.clearPressTimeout();
      this.resetState();
    }
  }

  private clearPressTimeout(): void {
    if (this.pressTimeout) {
      clearTimeout(this.pressTimeout);
      this.pressTimeout = null;
    }
  }

  private resetState(): void {
    this.isPressing = false;
    this.isLongPressTriggered = false;
    this.initialX = undefined;
    this.initialY = undefined;
  }

  ngOnDestroy(): void {
    this.clearPressTimeout();
  }
}
