import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { beforeEach, describe, expect, it } from 'vitest';
import { DateRangeValue } from '@shared/utils/dates/date-range-presets';
import { DateRangeFieldComponent } from './date-range-field.component';

describe('DateRangeFieldComponent', () => {
  let fixture: ComponentFixture<DateRangeFieldComponent>;
  let component: DateRangeFieldComponent;
  let emitted: DateRangeValue[];
  let validity: boolean[];

  const createComponent = (value: DateRangeValue) => {
    TestBed.configureTestingModule({
      imports: [DateRangeFieldComponent, NoopAnimationsModule],
    });

    fixture = TestBed.createComponent(DateRangeFieldComponent);
    component = fixture.componentInstance;
    component.value = value;
    fixture.detectChanges();

    emitted = [];
    validity = [];
    component.valueChange.subscribe(v => emitted.push(v));
    component.validityChange.subscribe(v => validity.push(v));
  };

  beforeEach(() => TestBed.resetTestingModule());

  it('should fill the start and clear the end when a preset chip is tapped', () => {
    createComponent({ preset: null, dateFrom: null, dateTo: null });

    component.onPresetSelected('3M');

    const last = emitted[emitted.length - 1]!;
    expect(last.preset).toBe('3M');
    expect(last.dateFrom).not.toBeNull();
    expect(last.dateTo).toBeNull();
    expect(component.activePreset()).toBe('3M');
  });

  it('should clear both bounds for the ALL preset', () => {
    createComponent({ preset: '3M', dateFrom: '2026-04-01T00:00:00.000Z', dateTo: null });

    component.onPresetSelected('ALL');

    const last = emitted[emitted.length - 1]!;
    expect(last.preset).toBe('ALL');
    expect(last.dateFrom).toBeNull();
    expect(last.dateTo).toBeNull();
  });

  it('should deselect the active chip when a date is edited by hand', () => {
    createComponent({ preset: '3M', dateFrom: '2026-04-01T00:00:00.000Z', dateTo: null });
    expect(component.activePreset()).toBe('3M');

    component.rangeForm.controls.start.setValue(new Date(2026, 0, 1));

    expect(component.activePreset()).toBeNull();
    expect(emitted[emitted.length - 1]!.preset).toBeNull();
  });

  it('should treat tapping the active chip as a no-op', () => {
    createComponent({ preset: '3M', dateFrom: '2026-04-01T00:00:00.000Z', dateTo: null });

    component.onPresetSelected('3M');

    expect(emitted).toHaveLength(0);
    expect(component.activePreset()).toBe('3M');
  });

  it('should emit the end date at end of day so the boundary is inclusive', () => {
    createComponent({ preset: null, dateFrom: null, dateTo: null });

    component.rangeForm.controls.end.setValue(new Date(2026, 6, 15));

    const dateTo = new Date(emitted[emitted.length - 1]!.dateTo!);
    expect(dateTo.getHours()).toBe(23);
    expect(dateTo.getMinutes()).toBe(59);
    expect(dateTo.getSeconds()).toBe(59);
    expect(dateTo.getMilliseconds()).toBe(999);
  });

  it('should report invalidity when the start date is after the end date', () => {
    createComponent({ preset: null, dateFrom: null, dateTo: null });

    component.rangeForm.controls.start.setValue(new Date(2026, 6, 20));
    component.rangeForm.controls.end.setValue(new Date(2026, 6, 10));

    expect(validity[validity.length - 1]).toBe(false);
  });

  it('should ignore an echo of its own value, so an in-progress edit is never rewritten', () => {
    createComponent({ preset: '3M', dateFrom: '2026-04-13T00:00:00.000Z', dateTo: null });

    component.rangeForm.controls.start.setValue(new Date(2026, 0, 1));
    const startBefore = component.rangeForm.controls.start.value;

    // A host binding [value] to what valueChange emitted feeds it straight back.
    component.value = emitted[emitted.length - 1]!;

    // Re-applying would rebuild the control from the ISO string, replacing the Date instance
    // and making the date adapter reformat the text the user is still typing.
    expect(component.rangeForm.controls.start.value).toBe(startBefore);
  });

  it('should report validity again once an inverted range is corrected', () => {
    createComponent({ preset: null, dateFrom: null, dateTo: null });

    component.rangeForm.controls.start.setValue(new Date(2026, 6, 20));
    component.rangeForm.controls.end.setValue(new Date(2026, 6, 10)); // inverted
    expect(validity[validity.length - 1]).toBe(false);

    component.rangeForm.controls.end.setValue(new Date(2026, 6, 25)); // corrected

    expect(validity[validity.length - 1]).toBe(true);
  });

  it('should treat an unparseable bound as absent, so no Invalid Date reaches the form', () => {
    createComponent({ preset: null, dateFrom: 'not-a-date', dateTo: null });

    expect(component.rangeForm.controls.start.value).toBeNull();

    // An Invalid Date is truthy, so reading it back through toISOString would throw a RangeError.
    expect(() => component.rangeForm.controls.end.setValue(new Date(2026, 6, 15))).not.toThrow();
    expect(emitted[emitted.length - 1]!.dateFrom).toBeNull();
  });

  it('should clear the field when the host passes no value', () => {
    createComponent({ preset: '3M', dateFrom: '2026-04-13T00:00:00.000Z', dateTo: null });

    component.value = null;

    expect(component.activePreset()).toBeNull();
    expect(component.rangeForm.controls.start.value).toBeNull();
    expect(component.rangeForm.controls.end.value).toBeNull();
  });

  it('should restore the active preset from the value input', () => {
    createComponent({ preset: '6M', dateFrom: '2026-01-13T00:00:00.000Z', dateTo: null });

    expect(component.activePreset()).toBe('6M');
    expect(component.showPresetLabel()).toBe(true);
  });

  it('should reveal the dates while the input is focused and restore the label on blur', () => {
    createComponent({ preset: '3M', dateFrom: '2026-04-13T00:00:00.000Z', dateTo: null });
    expect(component.showPresetLabel()).toBe(true);

    component.onInputFocus();
    expect(component.showPresetLabel()).toBe(false);

    component.onInputBlur();
    expect(component.showPresetLabel()).toBe(true);
  });

  it('should keep the label hidden after blur once a preset has been cleared', () => {
    createComponent({ preset: '3M', dateFrom: '2026-04-13T00:00:00.000Z', dateTo: null });

    component.onInputFocus();
    component.rangeForm.controls.start.setValue(new Date(2026, 0, 1)); // manual edit clears the preset
    component.onInputBlur();

    expect(component.activePreset()).toBeNull();
    expect(component.showPresetLabel()).toBe(false);
  });
});
