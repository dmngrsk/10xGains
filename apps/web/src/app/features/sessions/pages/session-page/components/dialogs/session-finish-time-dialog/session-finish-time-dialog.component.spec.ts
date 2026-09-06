import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { describe, expect, it, vi } from 'vitest';
import { SessionFinishTimeDialogComponent, SessionFinishTimeDialogData } from './session-finish-time-dialog.component';

const NOW = new Date(2026, 5, 2, 8, 47, 0); // Tue Jun 2, 08:47 local

describe('SessionFinishTimeDialogComponent', () => {
  let fixture: ComponentFixture<SessionFinishTimeDialogComponent>;
  let component: SessionFinishTimeDialogComponent;
  let close: ReturnType<typeof vi.fn>;

  const setup = async (data: Partial<SessionFinishTimeDialogData> = {}): Promise<void> => {
    close = vi.fn();

    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [SessionFinishTimeDialogComponent],
      providers: [
        provideNoopAnimations(),
        { provide: MatDialogRef, useValue: { close } },
        {
          provide: MAT_DIALOG_DATA,
          useValue: { now: NOW, sessionDate: null, setTimestamps: [], ...data } satisfies SessionFinishTimeDialogData,
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SessionFinishTimeDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  };

  describe('the instant it opens on', () => {
    it('should start from the last recorded set, snapped back to the picker grid', async () => {
      await setup({
        sessionDate: new Date(2026, 5, 2, 8, 0, 0),
        setTimestamps: [new Date(2026, 5, 2, 8, 23, 47)],
      });

      // Snapped back rather than to the closest option: the default must never claim the session
      // ran past its last recorded set. Exactness matters - the picker highlights an option only
      // when the value matches one, and falls back to midnight when it does not.
      expect(component.form.value.time).toEqual(new Date(2026, 5, 2, 8, 20, 0));
      expect(component.form.value.date).toEqual(new Date(2026, 5, 2, 8, 20, 0));
    });

    it('should fall back to now for a session with nothing recorded', async () => {
      await setup();

      expect(component.form.value.time).toEqual(new Date(2026, 5, 2, 8, 45, 0));
    });

    it('should start from the session itself when it has begun but recorded no set', async () => {
      await setup({ sessionDate: new Date(2026, 5, 2, 7, 32, 0) });

      expect(component.form.value.time).toEqual(new Date(2026, 5, 2, 7, 30, 0));
    });
  });

  describe('the instant it closes with', () => {
    it('should take the day from the date field and the clock from the time field', async () => {
      await setup({ setTimestamps: [new Date(2026, 5, 2, 8, 20, 0)] });

      component.form.patchValue({
        date: new Date(2026, 4, 30, 23, 15, 0),
        time: new Date(2026, 5, 2, 19, 30, 0),
      });
      fixture.detectChanges();
      component.onSave();

      expect(close).toHaveBeenCalledWith(new Date(2026, 4, 30, 19, 30, 0).toISOString());
    });

    it('should refuse an end in the future rather than closing with it', async () => {
      await setup({ setTimestamps: [new Date(2026, 5, 2, 8, 20, 0)] });

      component.form.patchValue({ time: new Date(2026, 5, 2, 9, 30, 0) });
      fixture.detectChanges();

      expect(component.isInFuture()).toBe(true);
      component.onSave();
      expect(close).not.toHaveBeenCalled();
    });

    it('should close with nothing when cancelled', async () => {
      await setup();

      component.onCancel();

      expect(close).toHaveBeenCalledWith();
    });
  });

  describe('the consequence it states', () => {
    const setsAt = (...times: [number, number][]): Date[] =>
      times.map(([h, m]) => new Date(2026, 5, 2, h, m, 0));

    it('should say nothing changes when the chosen end is after everything recorded', async () => {
      await setup({ sessionDate: new Date(2026, 5, 2, 8, 0, 0), setTimestamps: setsAt([8, 20]) });

      component.form.patchValue({ time: new Date(2026, 5, 2, 8, 30, 0) });
      fixture.detectChanges();

      expect(component.consequenceText()).toBe('Recorded set times are unchanged.');
    });

    it('should count every set when the whole session moves', async () => {
      await setup({ sessionDate: new Date(2026, 5, 2, 8, 0, 0), setTimestamps: setsAt([8, 10], [8, 20]) });

      component.form.patchValue({ date: new Date(2026, 5, 1, 0, 0, 0), time: new Date(2026, 5, 2, 20, 0, 0) });
      fixture.detectChanges();

      expect(component.consequenceText()).toBe('All 2 sets move back by 12 h 20 min.');
    });

    it('should not say "all" when some sets keep their recorded time', async () => {
      await setup({
        sessionDate: new Date(2026, 5, 1, 18, 0, 0),
        setTimestamps: [new Date(2026, 5, 1, 18, 0, 0), new Date(2026, 5, 1, 19, 25, 0), new Date(2026, 5, 2, 8, 30, 0)],
      });

      component.form.patchValue({ date: new Date(2026, 5, 1, 0, 0, 0), time: new Date(2026, 5, 2, 19, 30, 0) });
      fixture.detectChanges();

      expect(component.consequenceText()).toBe('1 set moves back by 13 h; the other 2 sets keep their recorded time.');
    });

    it('should hedge the shift when the block is clamped behind a set that stayed', async () => {
      await setup({
        sessionDate: new Date(2026, 5, 1, 19, 0, 0),
        setTimestamps: [new Date(2026, 5, 1, 19, 25, 0), new Date(2026, 5, 2, 8, 0, 0), new Date(2026, 5, 2, 8, 30, 0)],
      });

      component.form.patchValue({ date: new Date(2026, 5, 1, 0, 0, 0), time: new Date(2026, 5, 2, 19, 30, 0) });
      fixture.detectChanges();

      // The 08:00 set cannot travel the full 13 h without landing before the 19:25 one that stayed.
      expect(component.consequenceText()).toBe('2 sets move back by up to 13 h; the other set keeps its recorded time.');
    });

    it('should name the span the session will be recorded as', async () => {
      await setup({ sessionDate: new Date(2026, 5, 2, 8, 0, 0), setTimestamps: setsAt([8, 20]) });

      component.form.patchValue({ time: new Date(2026, 5, 2, 8, 40, 0) });
      fixture.detectChanges();

      expect(component.recordedAsText()).toBe('Tue, Jun 2 · 08:00 – 08:40');
    });
  });
});
