import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkoutPreferencesService } from './workout-preferences.service';

const ENABLED_KEY = 'txg.sessions.plate-calculator-enabled';
const INVENTORY_KEY = 'txg.sessions.plate-inventory';

describe('WorkoutPreferencesService', () => {
  const createService = () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    return TestBed.inject(WorkoutPreferencesService);
  };

  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it('should default the plate calculator to on', () => {
    expect(createService().plateCalculatorEnabled()).toBe(true);
  });

  it('should read a stored opt-out', () => {
    window.localStorage.setItem(ENABLED_KEY, '0');

    expect(createService().plateCalculatorEnabled()).toBe(false);
  });

  it('should persist the toggle', () => {
    const service = createService();

    service.setPlateCalculatorEnabled(false);

    expect(service.plateCalculatorEnabled()).toBe(false);
    expect(window.localStorage.getItem(ENABLED_KEY)).toBe('0');
  });

  it('should report no inventory until one is stored', () => {
    expect(createService().plateInventory()).toBeNull();
  });

  it('should round-trip the inventory', () => {
    const service = createService();

    service.setPlateInventory([20, 10, 5]);

    expect(service.plateInventory()).toEqual([20, 10, 5]);
    expect(createService().plateInventory()).toEqual([20, 10, 5]);
  });

  it('should ignore an unparseable inventory', () => {
    window.localStorage.setItem(INVENTORY_KEY, 'not json');

    expect(createService().plateInventory()).toBeNull();
  });

  it('should drop non-numeric entries from a hand-edited inventory', () => {
    window.localStorage.setItem(INVENTORY_KEY, JSON.stringify([20, 'twenty', null, 5]));

    expect(createService().plateInventory()).toEqual([20, 5]);
  });

  it('should survive storage being unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });

    const service = createService();

    expect(service.plateCalculatorEnabled()).toBe(true);
    expect(() => service.setPlateCalculatorEnabled(false)).not.toThrow();
    expect(service.plateCalculatorEnabled()).toBe(false);
  });
});
