import { Injectable, Signal, inject, signal } from '@angular/core';
import { LocalStorageService } from './local-storage.service';

const PLATE_CALCULATOR_ENABLED_KEY = 'txg.sessions.plate-calculator-enabled';
const PLATE_INVENTORY_KEY = 'txg.sessions.plate-inventory';

/**
 * Device-local workout preferences, read by the session page and written by the settings page.
 *
 * Nothing here round-trips to the server: these are properties of the gym the user is standing in,
 * not of their account. The signals are the single source of truth for the session, with
 * localStorage behind them - `LocalStorageService` already degrades to a no-op when storage throws,
 * so a browser that refuses it simply loses the preference on reload.
 *
 * The plate inventory is kept as plain numbers rather than the sessions feature's
 * `PlateDenominationKg`, because nothing in `shared/` may depend on a feature. Its consumer
 * narrows it with `sanitizeDenominations`, which is also where a hand-edited storage value is
 * dropped.
 */
@Injectable({
  providedIn: 'root',
})
export class WorkoutPreferencesService {
  private readonly storage = inject(LocalStorageService);

  private readonly plateCalculatorEnabledSignal = signal(this.readPlateCalculatorEnabled());
  private readonly plateInventorySignal = signal(this.readPlateInventory());

  /** Defaults to on: a utility nobody has discovered yet cannot be judged. */
  readonly plateCalculatorEnabled: Signal<boolean> = this.plateCalculatorEnabledSignal.asReadonly();

  /** Null until the user picks a rack, which is what makes the consumer's default apply. */
  readonly plateInventory: Signal<number[] | null> = this.plateInventorySignal.asReadonly();

  setPlateCalculatorEnabled(enabled: boolean): void {
    this.plateCalculatorEnabledSignal.set(enabled);
    this.storage.setItem(PLATE_CALCULATOR_ENABLED_KEY, enabled ? '1' : '0');
  }

  setPlateInventory(plates: readonly number[]): void {
    const stored = [...plates];
    this.plateInventorySignal.set(stored);
    this.storage.setItem(PLATE_INVENTORY_KEY, JSON.stringify(stored));
  }

  private readPlateCalculatorEnabled(): boolean {
    return this.storage.getItem(PLATE_CALCULATOR_ENABLED_KEY) !== '0';
  }

  private readPlateInventory(): number[] | null {
    const stored = this.storage.getItem(PLATE_INVENTORY_KEY);
    if (!stored) {
      return null;
    }

    try {
      const parsed: unknown = JSON.parse(stored);
      if (!Array.isArray(parsed)) {
        return null;
      }

      const numbers = parsed.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
      return numbers.length > 0 ? numbers : null;
    } catch {
      // User-editable storage; unparseable content just means "no preference yet".
      return null;
    }
  }
}
