import { Directive, EventEmitter, HostListener, Input, NgZone, OnDestroy, Output, inject } from '@angular/core';

const DEFAULT_LONG_PRESS_DURATION = 500; // ms
const DEFAULT_LONG_PRESS_MOVEMENT_THRESHOLD = 10; // px
const COMPATIBILITY_CLICK_WINDOW = 400; // ms

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
   * Emits the original event when a tap action is successfully detected.
   * A tap occurs if the pointer is released before the `txgLongPressDuration` elapses
   * and the movement has not exceeded `txgLongPressMovementThreshold`,
   * and a long press was not triggered. Keyboard activation (Enter/Space on the host,
   * or an assistive-technology click) also emits, via the synthesized `click` event.
   */
  @Output() txgClick = new EventEmitter<MouseEvent>();

  private pressTimeout: ReturnType<typeof setTimeout> | null = null;
  private disarmSwallow: (() => void) | null = null;
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
    const wasLongPress = this.isLongPressTriggered;
    this.clearPressTimeout();

    if (wasLongPress) {
      // Whatever the press opened has been on screen since the duration elapsed, so it is what
      // the finger is lifting off of. Arm here rather than when the long press fired: the click
      // follows the release, which may be a good while later.
      this.swallowCompatibilityClick();
    } else if (wasPressing && !this.txgLongPressDisabled) {
      if (this.initialX !== undefined && this.initialY !== undefined) {
        const deltaX = Math.abs(event.clientX - this.initialX);
        const deltaY = Math.abs(event.clientY - this.initialY);
        if (deltaX <= this.txgLongPressMovementThreshold && deltaY <= this.txgLongPressMovementThreshold) {
          this.swallowCompatibilityClick();
          this.txgClick.emit(event);
        }
      }
    }
    this.resetState();
  }

  @HostListener('click', ['$event'])
  onClick(event: MouseEvent): void {
    // Pointer-driven taps are handled in onPointerUp; keyboard (Enter/Space) and
    // assistive-technology activation dispatch a click with detail === 0 and no pointer
    // events at all, so without this branch the host is unusable on non-pointer devices.
    if (event.detail !== 0 || this.txgLongPressDisabled) return;
    this.txgClick.emit(event);
  }

  // `pointercancel` fires when the browser takes the pointer over - a scroll or pinch taking over
  // the gesture, or the touch being interrupted - without any `pointerleave`, so it needs the same
  // treatment or the press would stay armed after the gesture is gone.
  @HostListener('pointerleave')
  @HostListener('pointercancel')
  onPointerLeave(): void {
    if (this.isPressing) {
      this.clearPressTimeout();
      this.resetState();
    }
  }

  ngOnDestroy(): void {
    this.clearPressTimeout();
    this.disarmSwallow?.();
  }

  /**
   * A touch gesture is followed by a synthesized mouse sequence, and the browser hit-tests that
   * trailing `click` against the DOM as it stands *then* - not as it stood when the finger went
   * down. Whatever this press opened is by that point under the finger, so the click lands on a
   * dialog's backdrop and dismisses it, or on a freshly drawn list item and activates it. The
   * gesture has already been reported through `txgClick`/`txgLongPress`, so that click is
   * redundant: swallow the next one, and disarm shortly after in case none arrives (a mouse
   * gesture on an element the pointer has since left, or a cancelled touch, produces none).
   */
  private swallowCompatibilityClick(): void {
    this.disarmSwallow?.();

    this.ngZone.runOutsideAngular(() => {
      const swallow = (event: MouseEvent) => {
        event.stopPropagation();
        event.preventDefault();
        disarm();
      };

      const timeout = setTimeout(() => disarm(), COMPATIBILITY_CLICK_WINDOW);
      const disarm = () => {
        clearTimeout(timeout);
        document.removeEventListener('click', swallow, true);
        this.disarmSwallow = null;
      };

      document.addEventListener('click', swallow, true);
      this.disarmSwallow = disarm;
    });
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
}
