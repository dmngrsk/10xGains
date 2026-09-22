import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LogMeasurementDialogData } from '@features/measurements/models/measurements.viewmodel';
import { LogMeasurementDialogComponent } from './log-measurement-dialog.component';
import type { MeasurementType } from '@txg/shared';

describe('LogMeasurementDialogComponent', () => {
  let component: LogMeasurementDialogComponent;
  let fixture: ComponentFixture<LogMeasurementDialogComponent>;
  const close = vi.fn();

  const setUp = async (data: Partial<LogMeasurementDialogData> = {}) => {
    close.mockReset();
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [LogMeasurementDialogComponent, NoopAnimationsModule],
      providers: [
        { provide: MatDialogRef, useValue: { close } },
        {
          provide: MAT_DIALOG_DATA,
          useValue: { types: ['BODY_WEIGHT'], lastValues: {}, ...data } as LogMeasurementDialogData,
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LogMeasurementDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  };

  const valueOf = (type: MeasurementType) =>
    (fixture.nativeElement.querySelector(`[data-cy="log-measurement-${type}"]`) as HTMLInputElement).value;

  const press = (direction: 'up' | 'down', type: MeasurementType) => {
    (fixture.nativeElement.querySelector(`[data-cy="log-measurement-${direction}-${type}"]`) as HTMLButtonElement).click();
    fixture.detectChanges();
  };

  beforeEach(() => setUp());

  describe('grouping', () => {
    it('should head each group by instrument, in catalog order', async () => {
      await setUp({ types: ['SKINFOLD_CHEST', 'WAIST', 'BODY_WEIGHT'] });

      expect(component.groups.map(g => g.instrument)).toEqual(['Scale', 'Tape', 'Calipers']);
    });

    it('should carry the same hint the Settings checklist shows', async () => {
      await setUp({ types: ['BODY_WEIGHT'] });

      expect(component.groups[0].hint).toContain('whatever protocol you follow');
    });

    // The heading says "Calipers", so the field need not say "skinfold" as well - and the -/+
    // buttons took the width the long form needed.
    it('should label a field by its short form', async () => {
      await setUp({ types: ['SKINFOLD_ABDOMEN'] });

      expect(component.groups[0].fields[0].shortLabel).toBe('Abs fold');
      expect(component.groups[0].fields[0].label).toBe('Abdomen skinfold');
    });
  });

  /** In place of the browser's spinners, which are a few pixels wide and absent on mobile. */
  describe('the -/+ buttons', () => {
    it('should start an empty field at one step rather than at zero', () => {
      press('up', 'BODY_WEIGHT');

      // Zero is a reading the API rejects, and a blank means "not measured today".
      expect(valueOf('BODY_WEIGHT')).toBe('0.1');
    });

    it('should leave an empty field empty when stepped down', () => {
      press('down', 'BODY_WEIGHT');

      expect(valueOf('BODY_WEIGHT')).toBe('');
    });

    it('should not drift on repeated steps', async () => {
      await setUp({ types: ['BODY_WEIGHT'], lastValues: { BODY_WEIGHT: { value: 79.9, measuredOn: '2026-09-01' } } });

      press('up', 'BODY_WEIGHT');

      // 79.9 + 0.1 is 80.00000000000001 in binary floating point.
      expect(valueOf('BODY_WEIGHT')).toBe('80');
    });

    it('should step back down past the value it started from', async () => {
      await setUp({ types: ['BODY_WEIGHT'], lastValues: { BODY_WEIGHT: { value: 80, measuredOn: '2026-09-01' } } });

      press('down', 'BODY_WEIGHT');
      press('down', 'BODY_WEIGHT');

      expect(valueOf('BODY_WEIGHT')).toBe('79.8');
    });

    it('should clear rather than go to zero or below', async () => {
      await setUp({ types: ['BODY_WEIGHT'], lastValues: { BODY_WEIGHT: { value: 0.1, measuredOn: '2026-09-01' } } });

      press('down', 'BODY_WEIGHT');

      expect(valueOf('BODY_WEIGHT')).toBe('');
    });
  });

  describe('saving', () => {
    it('should send only the fields that were filled in', async () => {
      await setUp({ types: ['BODY_WEIGHT', 'WAIST'] });
      press('up', 'BODY_WEIGHT');

      component.onSave();

      expect(close).toHaveBeenCalledWith([
        expect.objectContaining({ type: 'BODY_WEIGHT', value: 0.1 }),
      ]);
    });

    /**
     * Every field arrives prefilled, so writing all of them would re-record a waist measured
     * three weeks ago as measured today - inventing data, and leaving the estimator with nothing
     * ever carried forward and its staleness windows never reached.
     */
    it('should not re-record a prefilled field the user never touched', async () => {
      await setUp({
        types: ['BODY_WEIGHT', 'WAIST'],
        lastValues: {
          BODY_WEIGHT: { value: 79, measuredOn: '2026-09-01' },
          WAIST: { value: 84, measuredOn: '2026-08-01' },
        },
      });

      press('up', 'BODY_WEIGHT');
      component.onSave();

      expect(close).toHaveBeenCalledWith([
        expect.objectContaining({ type: 'BODY_WEIGHT', value: 79.1 }),
      ]);
    });

    it('should close with nothing when every field is left as it was', async () => {
      await setUp({
        types: ['BODY_WEIGHT'],
        lastValues: { BODY_WEIGHT: { value: 79, measuredOn: '2026-09-01' } },
      });

      component.onSave();

      expect(close).toHaveBeenCalledWith(undefined);
    });

    it('should close with nothing when no field was filled in', () => {
      component.onSave();

      expect(close).toHaveBeenCalledWith(undefined);
    });
  });
});
