import { TestBed } from '@angular/core/testing';
import { MatSlideToggle } from '@angular/material/slide-toggle';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { WorkoutPreferencesService } from '@shared/services/workout-preferences.service';
import { WorkoutSettingsCardComponent } from './workout-settings-card.component';

const ENABLED_KEY = 'txg.sessions.plate-calculator-enabled';

describe('WorkoutSettingsCardComponent', () => {
  const createFixture = () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [WorkoutSettingsCardComponent, NoopAnimationsModule] });

    const fixture = TestBed.createComponent(WorkoutSettingsCardComponent);
    fixture.detectChanges();
    return fixture;
  };

  const toggleOf = (fixture: ReturnType<typeof createFixture>): MatSlideToggle =>
    fixture.debugElement.query(node => node.attributes['data-cy'] === 'settings-plate-calculator-toggle')
      .componentInstance;

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

    const switchButton: HTMLButtonElement = fixture.nativeElement.querySelector('button[role="switch"]');
    switchButton.click();
    fixture.detectChanges();

    expect(TestBed.inject(WorkoutPreferencesService).plateCalculatorEnabled()).toBe(false);
    expect(window.localStorage.getItem(ENABLED_KEY)).toBe('0');
  });
});
