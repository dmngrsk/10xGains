import { ComponentFixture, TestBed } from '@angular/core/testing';
import { getDay } from 'date-fns';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionCardViewModel } from '@features/sessions/models/session-card.viewmodel';
import { HistoryCalendarComponent } from './history-calendar.component';

const session = (id: string, sessionDate: Date | null): SessionCardViewModel => ({
  id,
  title: `Session ${id}`,
  sessionDate,
  status: 'COMPLETED',
  notes: null,
  exercises: [],
});

describe('HistoryCalendarComponent', () => {
  let fixture: ComponentFixture<HistoryCalendarComponent>;
  let component: HistoryCalendarComponent;

  const createComponent = (sessions: SessionCardViewModel[], month = '2026-05') => {
    TestBed.configureTestingModule({
      imports: [HistoryCalendarComponent],
    });

    fixture = TestBed.createComponent(HistoryCalendarComponent);
    component = fixture.componentInstance;
    component.month = month;
    component.sessions = sessions;
    fixture.detectChanges();
    return component;
  };

  const monthSection = (key: string): HTMLElement | null =>
    fixture.nativeElement.querySelector(`[data-month="${key}"]`);

  beforeEach(() => TestBed.resetTestingModule());

  describe('sessionsByDay', () => {
    it('should group sessions by their local day', () => {
      createComponent([
        session('a', new Date(2026, 4, 10, 8, 0)),
        session('b', new Date(2026, 4, 10, 18, 30)),
        session('c', new Date(2026, 4, 12, 9, 0)),
      ]);

      const byDay = component.sessionsByDay();

      expect(byDay.get('2026-05-10')?.map(s => s.id)).toEqual(['a', 'b']);
      expect(byDay.get('2026-05-12')?.map(s => s.id)).toEqual(['c']);
      expect(byDay.size).toBe(2);
    });

    it('should exclude sessions without a session date', () => {
      createComponent([
        session('a', new Date(2026, 4, 10)),
        session('b', null),
      ]);

      expect(component.sessionsByDay().size).toBe(1);
      expect(component.sessionsByDay().get('2026-05-10')?.map(s => s.id)).toEqual(['a']);
    });
  });

  describe('renderedMonths', () => {
    it('should render a window of months around the anchor', () => {
      createComponent([], '2026-05');

      const keys = component.renderedMonths().map(m => m.key);

      expect(keys[0]).toBe('2025-11');
      expect(keys[keys.length - 1]).toBe('2026-11');
      expect(keys).toContain('2026-05');
      expect(keys).toHaveLength(13);
    });

    it('should lay out each month as a fixed 6x7 grid with correct day placement', () => {
      createComponent([], '2026-05');

      const may = component.renderedMonths().find(m => m.key === '2026-05')!;
      const dayCells = may.days.filter(day => day !== null);

      expect(may.days).toHaveLength(42);
      expect(may.label).toBe('May 2026');
      expect(dayCells).toHaveLength(31);
      expect(may.days.findIndex(day => day !== null)).toBe((getDay(new Date(2026, 4, 1)) + 6) % 7);
      expect(dayCells[9]!.key).toBe('2026-05-10');
    });

    it('should rebuild the window when the month input jumps outside of it', () => {
      createComponent([], '2026-05');

      component.month = '2020-01';

      const keys = component.renderedMonths().map(m => m.key);
      expect(keys[0]).toBe('2019-07');
      expect(keys[keys.length - 1]).toBe('2020-07');
    });
  });

  describe('day rendering', () => {
    it('should mark session days as tappable buttons with dots', () => {
      createComponent([
        session('a', new Date(2026, 4, 10, 8, 0)),
        session('b', new Date(2026, 4, 10, 18, 0)),
        session('c', new Date(2026, 4, 12)),
      ]);

      const may = monthSection('2026-05')!;
      const sessionDays = may.querySelectorAll('button.txg-session-day');
      const multiDays = may.querySelectorAll('button.txg-session-day--multi');

      expect(sessionDays).toHaveLength(2);
      expect(multiDays).toHaveLength(1);
      expect(multiDays[0].textContent!.trim()).toBe('10');
    });

    it('should render days without sessions as non-interactive cells', () => {
      createComponent([session('a', new Date(2026, 4, 10))]);

      const may = monthSection('2026-05')!;

      expect(may.querySelectorAll('button')).toHaveLength(1); // only the session day is a button
      expect(may.querySelectorAll('span.txg-day--disabled').length).toBe(30);
    });
  });

  describe('dayClicked', () => {
    it('should emit the sessions of the clicked day', () => {
      createComponent([
        session('a', new Date(2026, 4, 10, 8, 0)),
        session('b', new Date(2026, 4, 10, 18, 0)),
      ]);
      const emitted = vi.fn();
      component.dayClicked.subscribe(emitted);

      monthSection('2026-05')!.querySelector('button')!.click();

      expect(emitted).toHaveBeenCalledExactlyOnceWith([
        expect.objectContaining({ id: 'a' }),
        expect.objectContaining({ id: 'b' }),
      ]);
    });

    it('should not emit for a day without sessions', () => {
      createComponent([session('a', new Date(2026, 4, 10))]);
      const emitted = vi.fn();
      component.dayClicked.subscribe(emitted);

      component.onDayClicked('2026-05-11');

      expect(emitted).not.toHaveBeenCalled();
    });
  });
});
