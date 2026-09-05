import { TestBed } from '@angular/core/testing';
import { MatChipOption, MatChipSelectionChange } from '@angular/material/chips';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkoutPreferencesService } from '@shared/services/workout-preferences.service';
import { PlateCalculatorDialogComponent } from './plate-calculator-dialog.component';

describe('PlateCalculatorDialogComponent', () => {
  const createFixture = (initialWeightKg: number) => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [PlateCalculatorDialogComponent, NoopAnimationsModule],
      providers: [{ provide: MAT_DIALOG_DATA, useValue: { initialWeightKg } }],
    });

    const fixture = TestBed.createComponent(PlateCalculatorDialogComponent);
    fixture.detectChanges();
    return fixture;
  };

  const query = (fixture: ReturnType<typeof createFixture>, dataCy: string): HTMLElement | null =>
    fixture.nativeElement.querySelector(`[data-cy="${dataCy}"]`);

  const toggle = (selected: boolean): MatChipSelectionChange =>
    ({ isUserInput: true, selected, source: { selected } as MatChipOption }) as MatChipSelectionChange;

  beforeEach(() => window.localStorage.clear());
  afterEach(() => window.localStorage.clear());

  it('should open on the weight the session asked for', () => {
    expect(createFixture(100).componentInstance.weightKg()).toBe(100);
  });

  it('should show a prescribed weight the rack cannot build, rather than snapping it', () => {
    const fixture = createFixture(101);

    expect(fixture.componentInstance.weightKg()).toBe(101);
    expect(query(fixture, 'plate-calculator-shortfall')?.textContent)
      .toContain('1 kg short — closest loadable is 100 kg');
  });

  it('should undo a typed weight on Escape without letting the dialog close', () => {
    const fixture = createFixture(100);
    const input = query(fixture, 'plate-calculator-weight-input') as HTMLInputElement;
    input.value = '250';
    const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    // The CDK closes the dialog from a keydown listener on `body`; this must never reach it.
    const reachedBody = vi.fn();
    document.body.addEventListener('keydown', reachedBody);

    input.dispatchEvent(escape);
    document.body.removeEventListener('keydown', reachedBody);

    expect(input.value).toBe('100');
    expect(reachedBody).not.toHaveBeenCalled();
  });

  it('should not orphan a repeat when a second finger lands on the button', () => {
    vi.useFakeTimers();
    const component = createFixture(100).componentInstance;

    component.onStepPressed(1);
    component.onStepPressed(1);
    component.onStepReleased();
    vi.advanceTimersByTime(2000);

    expect(component.weightKg()).toBe(105);
    vi.useRealTimers();
  });

  it('should clamp a weight below the bar up to the bar', () => {
    expect(createFixture(0).componentInstance.weightKg()).toBe(20);
  });

  it('should render the loading and the drawing', () => {
    const fixture = createFixture(100);

    expect(query(fixture, 'plate-calculator-loading')?.textContent).toContain('20');
    expect(fixture.nativeElement.querySelector('svg title').textContent)
      .toBe('A 20 kilogram bar loaded with 2 plates of 20 kg per side.');
  });

  it('should draw the bar at the same size however much is loaded', () => {
    const viewBoxOf = (kg: number) =>
      createFixture(kg).nativeElement.querySelector('svg').getAttribute('viewBox');

    window.localStorage.setItem('txg.sessions.plate-inventory', JSON.stringify([25, 20, 10, 5, 2.5, 1.25]));

    expect(viewBoxOf(20)).toBe(viewBoxOf(100));
    expect(viewBoxOf(20)).toBe(viewBoxOf(300));
  });

  it('should state the current increment rather than the next weight', () => {
    const fixture = createFixture(100);

    expect(query(fixture, 'plate-calculator-step-hint')?.textContent?.trim()).toBe('Steps by 2.5 kg from here');
  });

  it('should walk the loadable weights when stepped', () => {
    const component = createFixture(100).componentInstance;

    component.onStepPressed(1);
    component.onStepReleased();

    expect(component.weightKg()).toBe(102.5);
  });

  it('should stop a held button repeating once it runs into the bar', () => {
    vi.useFakeTimers();
    const fixture = createFixture(25);
    const component = fixture.componentInstance;

    component.onStepPressed(-1);
    vi.advanceTimersByTime(1000);
    expect(component.weightKg()).toBe(20);

    // The button is disabled at the floor, so its pointerup never arrives - the repeat has to have
    // stopped itself, or it would carry on stepping the next weight the user types.
    const input = query(fixture, 'plate-calculator-weight-input') as HTMLInputElement;
    input.value = '100';
    component.onWeightCommitted(input);
    vi.advanceTimersByTime(1000);

    expect(component.weightKg()).toBe(100);
    vi.useRealTimers();
  });

  it('should not step below the bar', () => {
    const component = createFixture(20).componentInstance;

    expect(component.canDecrement()).toBe(false);
  });

  it('should show only the default five chips, ascending', () => {
    expect(createFixture(100).componentInstance.visibleDenominations()).toEqual([1.25, 2.5, 5, 10, 20]);
  });

  it('should keep a selected 25 in the collapsed row', () => {
    window.localStorage.setItem('txg.sessions.plate-inventory', JSON.stringify([25, 20, 10, 5, 2.5, 1.25]));

    expect(createFixture(100).componentInstance.visibleDenominations()).toEqual([1.25, 2.5, 5, 10, 20, 25]);
  });

  it('should reveal the whole ladder when expanded', () => {
    const component = createFixture(100).componentInstance;

    component.onLadderToggled();

    expect(component.visibleDenominations()).toHaveLength(11);
  });

  it('should drop a deselected plate out of the collapsed row and persist the rack', () => {
    window.localStorage.setItem('txg.sessions.plate-inventory', JSON.stringify([25, 20, 10, 5, 2.5, 1.25]));
    const component = createFixture(100).componentInstance;

    component.onDenominationToggled(25, toggle(false));

    expect(component.available()).toEqual([20, 10, 5, 2.5, 1.25]);
    expect(component.visibleDenominations()).toEqual([1.25, 2.5, 5, 10, 20]);
    expect(TestBed.inject(WorkoutPreferencesService).plateInventory()).toEqual([20, 10, 5, 2.5, 1.25]);
  });

  it('should refuse to deselect the last plate, because an empty rack has no answer', () => {
    window.localStorage.setItem('txg.sessions.plate-inventory', JSON.stringify([20]));
    const component = createFixture(100).componentInstance;
    const event = toggle(false);

    component.onDenominationToggled(20, event);

    expect(component.available()).toEqual([20]);
    expect(event.source.selected).toBe(true);
  });

  it('should re-snap the weight when a chip change strands it', () => {
    window.localStorage.setItem('txg.sessions.plate-inventory', JSON.stringify([20, 10, 5, 2.5, 1.25, 0.5]));
    const component = createFixture(101).componentInstance;
    expect(component.weightKg()).toBe(101);

    component.onDenominationToggled(0.5, toggle(false));

    expect(component.weightKg()).toBe(100);
  });

  it('should solve a typed weight as given rather than snapping it', () => {
    const fixture = createFixture(100);
    const input = query(fixture, 'plate-calculator-weight-input') as HTMLInputElement;

    input.value = '47,3';
    fixture.componentInstance.onWeightCommitted(input);
    fixture.detectChanges();

    expect(fixture.componentInstance.weightKg()).toBe(47.3);
    expect(query(fixture, 'plate-calculator-shortfall')?.textContent)
      .toContain('2.3 kg short — closest loadable is 45 kg');
  });

  it('should revert an unparseable weight instead of falling to zero', () => {
    const fixture = createFixture(100);
    const input = query(fixture, 'plate-calculator-weight-input') as HTMLInputElement;

    input.value = 'heavy';
    fixture.componentInstance.onWeightCommitted(input);

    expect(fixture.componentInstance.weightKg()).toBe(100);
    expect(input.value).toBe('100');
  });

  it('should clamp a typed weight to the working range', () => {
    const fixture = createFixture(100);
    const input = query(fixture, 'plate-calculator-weight-input') as HTMLInputElement;

    input.value = '900';
    fixture.componentInstance.onWeightCommitted(input);

    expect(fixture.componentInstance.weightKg()).toBe(500);
  });

  it('should stay quiet about an even rack', () => {
    const fixture = createFixture(100);

    expect(query(fixture, 'plate-calculator-uneven-warning')).toBeNull();
  });

  it('should warn about a rack whose steps are uneven', () => {
    window.localStorage.setItem('txg.sessions.plate-inventory', JSON.stringify([25, 20, 15]));
    const fixture = createFixture(100);

    expect(query(fixture, 'plate-calculator-uneven-warning')?.textContent)
      .toContain('Uneven rack — loadable weights step by 10 and 30 kg.');
  });

  it('should read the warning before the chips it is about', () => {
    window.localStorage.setItem('txg.sessions.plate-inventory', JSON.stringify([25, 20, 15]));
    const fixture = createFixture(100);
    const warning = query(fixture, 'plate-calculator-uneven-warning') as HTMLElement;
    const chips = query(fixture, 'plate-calculator-chips') as HTMLElement;

    expect(warning.compareDocumentPosition(chips) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(chips.getAttribute('aria-describedby')).toBe(warning.id);
  });
});
