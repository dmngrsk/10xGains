import { Injectable } from '@angular/core';
import { NativeDateAdapter } from '@angular/material/core';

/**
 * The stock NativeDateAdapter derives the first day of the week from the runtime locale
 * (Sunday under the default en-US); the app standardizes on Monday-first weeks instead.
 */
@Injectable()
export class MondayFirstDateAdapter extends NativeDateAdapter {
  override getFirstDayOfWeek(): number {
    return 1;
  }
}
