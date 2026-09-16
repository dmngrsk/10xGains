import { TestBed } from '@angular/core/testing';
import { MatSlideToggle } from '@angular/material/slide-toggle';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { WorkoutPreferencesService } from '@shared/services/workout-preferences.service';
import { SessionSettingsCardComponent } from './session-settings-card.component';

const ENABLED_KEY = 'txg.sessions.plate-calculator-enabled';
const WARMUP_KEY = 'txg.sessions.warmup-sets-enabled';

describe('SessionSettingsCardComponent', () => {
  const createFixture = () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [SessionSettingsCardComponent, NoopAnimationsModule] });

    const fixture = TestBed.createComponent(SessionSettingsCardComponent);
    fixture.detectChanges();
    return fixture;
  };

  const toggleOf = (fixture: ReturnType<typeof createFixture>, dataCy = 'settings-plate-calculator-toggle'): MatSlideToggle =>
    fixture.debugElement.query(node => node.attributes['data-cy'] === dataCy).componentInstance;

  beforeEach(() => window.localStorage.clear());
  afterEach(() => window.localStorage.clear());

  it('should show the plate calculator as on by default', () => {
    expect(toggleOf(createFixture()).checked).toBe(true);
  });

  it('should reflect a stored opt-out', () => {
    window.localStorage.setItem(ENABLED_KEY, '0');

    expect(toggleOf(createFixture()).checked).toBe(false);
  });

  it('should write the preference through on change, with no Save step', () => {
    const fixture = createFixture();

    const switchButton: HTMLButtonElement = fixture.nativeElement.querySelector('[data-cy="settings-plate-calculator-toggle"] button[role="switch"]');
    switchButton.click();
    fixture.detectChanges();

    expect(TestBed.inject(WorkoutPreferencesService).plateCalculatorEnabled()).toBe(false);
    expect(window.localStorage.getItem(ENABLED_KEY)).toBe('0');
  });

  it('should show warmup sets as on by default, and reflect a stored opt-out', () => {
    expect(toggleOf(createFixture(), 'settings-warmup-sets-toggle').checked).toBe(true);

    window.localStorage.setItem(WARMUP_KEY, '0');

    expect(toggleOf(createFixture(), 'settings-warmup-sets-toggle').checked).toBe(false);
  });

  it('should write the warmup sets preference through on change', () => {
    const fixture = createFixture();

    const switchButton: HTMLButtonElement = fixture.nativeElement.querySelector('[data-cy="settings-warmup-sets-toggle"] button[role="switch"]');
    switchButton.click();
    fixture.detectChanges();

    expect(TestBed.inject(WorkoutPreferencesService).warmupSetsEnabled()).toBe(false);
    expect(window.localStorage.getItem(WARMUP_KEY)).toBe('0');
  });
});
