import { TestBed } from '@angular/core/testing';
import { MatBottomSheetRef, MAT_BOTTOM_SHEET_DATA } from '@angular/material/bottom-sheet';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionFinishSheetComponent, SessionFinishSheetData, SessionFinishSheetResult } from './session-finish-sheet.component';

const NOW = new Date('2026-06-01T21:47:00.000Z');

describe('SessionFinishSheetComponent', () => {
  let dismiss: ReturnType<typeof vi.fn>;

  const createComponent = (data: Partial<SessionFinishSheetData> = {}): SessionFinishSheetComponent => {
    dismiss = vi.fn();

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [SessionFinishSheetComponent, NoopAnimationsModule],
      providers: [
        { provide: MatBottomSheetRef, useValue: { dismiss } },
        {
          provide: MAT_BOTTOM_SHEET_DATA,
          useValue: { now: NOW, lastSetCompletedAt: null, ...data } satisfies SessionFinishSheetData,
        },
      ],
    });

    const fixture = TestBed.createComponent(SessionFinishSheetComponent);
    fixture.detectChanges();
    return fixture.componentInstance;
  };

  beforeEach(() => TestBed.resetTestingModule());

  it('should hide the last-set option when no set has been recorded', () => {
    expect(createComponent().showLastSetOption).toBe(false);
  });

  it.each([
    ['seconds ago', '2026-06-01T21:46:30.000Z'],
    ['hours ago', '2026-06-01T19:25:00.000Z'],
  ])('should offer the last-set option for a set logged %s', (_label, completedAt) => {
    const component = createComponent({ lastSetCompletedAt: new Date(completedAt) });

    expect(component.showLastSetOption).toBe(true);
  });

  it('should emit the last set instant when that option is taken', () => {
    const lastSet = new Date('2026-06-01T19:25:00.000Z');
    const component = createComponent({ lastSetCompletedAt: lastSet });
    const choices: SessionFinishSheetResult[] = [];
    component.choice.subscribe(choice => choices.push(choice));

    component.onFinishAtLastSet();

    expect(choices).toEqual([{ kind: 'lastSet', endAt: lastSet.toISOString() }]);
    expect(dismiss).toHaveBeenCalled();
  });

  it('should emit the choice before the sheet is dismissed, so the next step opens right away', () => {
    const component = createComponent();
    const order: string[] = [];
    component.choice.subscribe(() => order.push('choice'));
    dismiss.mockImplementation(() => order.push('dismiss'));

    component.onFinishNow();

    expect(order).toEqual(['choice', 'dismiss']);
  });

  it.each([
    ['now', (c: SessionFinishSheetComponent) => c.onFinishNow(), { kind: 'now' }],
    ['pick', (c: SessionFinishSheetComponent) => c.onPickDateTime(), { kind: 'pick' }],
  ])('should emit the %p choice', (_label, act, expected) => {
    const component = createComponent();
    const choices: SessionFinishSheetResult[] = [];
    component.choice.subscribe(choice => choices.push(choice));

    act(component);

    expect(choices).toEqual([expected]);
    expect(dismiss).toHaveBeenCalled();
  });
});
