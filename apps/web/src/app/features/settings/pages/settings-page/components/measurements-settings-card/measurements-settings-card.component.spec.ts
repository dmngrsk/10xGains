import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatChipSelectionChange } from '@angular/material/chips';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { beforeEach, describe, expect, it } from 'vitest';
import { MeasurementsSettingsCardComponent, MeasurementsSettingsSaved } from './measurements-settings-card.component';
import type { MeasurementsSettingsCardViewModel } from '../../../../models/settings-page.viewmodel';
import type { MeasurementType } from '@txg/shared';

const EMPTY: MeasurementsSettingsCardViewModel = {
  heightCm: null,
  dateOfBirth: null,
  bodyFatMethod: null,
  sex: null,
  frequencyDays: null,
  trackedTypes: null,
  loggedTypes: [],
};

describe('MeasurementsSettingsCardComponent', () => {
  let component: MeasurementsSettingsCardComponent;
  let fixture: ComponentFixture<MeasurementsSettingsCardComponent>;

  const setUp = (measurements: Partial<MeasurementsSettingsCardViewModel> = {}) => {
    fixture = TestBed.createComponent(MeasurementsSettingsCardComponent);
    component = fixture.componentInstance;
    component.measurements = { ...EMPTY, ...measurements };
    fixture.detectChanges();
  };

  /** Drives the method select the way the template does: patch the form, then notify. */
  const chooseMethod = (bodyFatMethod: string | null, sex: string | null = 'MALE') => {
    component.form.patchValue({ bodyFatMethod, sex });
    component.onMethodChanged();
  };

  const saved = (): MeasurementsSettingsSaved => {
    let result!: MeasurementsSettingsSaved;
    component.measurementsSaved.subscribe(value => (result = value));
    component.onSaved();
    return result;
  };

  const listed = (): MeasurementType[] =>
    component.visibleGroups().flatMap(group => group.types.map(item => item.type));

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MeasurementsSettingsCardComponent, NoopAnimationsModule],
    }).compileComponents();
  });

  /**
   * An unset column means the user has not chosen, and the chart falls back to inferring from what
   * they have logged. Seeding the boxes empty made the first save persist that empty set as a
   * deliberate choice and silently blank the chart.
   */
  describe('seeding', () => {
    it('should tick body weight when nothing has been chosen and nothing logged', () => {
      setUp({ trackedTypes: null });

      expect(saved().trackedTypes).toEqual(['BODY_WEIGHT']);
    });

    it('should treat a stored empty set the same way', () => {
      setUp({ trackedTypes: [] });

      expect(saved().trackedTypes).toEqual(['BODY_WEIGHT']);
    });

    /**
     * The chart infers an unset column from what has been logged. Seeding from the raw column
     * made the first save persist a narrower set and silently drop series already on screen.
     */
    it('should seed from what has been logged when the column is unset', () => {
      setUp({ trackedTypes: null, loggedTypes: ['WAIST', 'CHEST'] });

      // Body weight comes along: the inference offers it whatever else was logged.
      expect(saved().trackedTypes).toEqual(['BODY_WEIGHT', 'CHEST', 'WAIST']);
    });

    it('should prefer an explicit set over what has been logged', () => {
      setUp({ trackedTypes: ['BICEPS'], loggedTypes: ['WAIST', 'CHEST'] });

      expect(saved().trackedTypes).toEqual(['BICEPS']);
    });

    it('should use the stored set when there is one', () => {
      setUp({ trackedTypes: ['WAIST', 'BICEPS'] });

      expect(saved().trackedTypes.sort()).toEqual(['BICEPS', 'WAIST']);
    });
  });

  /**
   * An estimate missing an input is not a weaker estimate, it is no estimate, so a checkbox that
   * silently breaks the number above it would be a trap.
   */
  describe('what the chosen formula requires', () => {
    it('should tick and lock the tape sites the US Navy reads', () => {
      setUp();
      chooseMethod('NAVY');

      for (const type of ['NECK', 'WAIST'] as MeasurementType[]) {
        expect(component.isTracked(type), `${type} ticked`).toBe(true);
        expect(component.isReadByMethod(type), `${type} locked`).toBe(true);
      }
    });

    it('should refuse to untick a measurement the formula reads', () => {
      setUp();
      chooseMethod('NAVY');

      component.onTrackedToggled('WAIST');

      expect(component.isTracked('WAIST')).toBe(true);
    });

    it('should read the hips for the female variant and not the male one', () => {
      setUp();
      chooseMethod('NAVY', 'FEMALE');
      expect(component.isReadByMethod('HIPS')).toBe(true);

      chooseMethod('NAVY', 'MALE');
      expect(component.isReadByMethod('HIPS')).toBe(false);
    });
  });

  /**
   * A field the chosen formula never reads is hidden rather than shown and ignored, so the three
   * profile inputs appear and disappear with the method.
   */
  describe('which profile fields a method needs', () => {
    it('should ask for height but not age under the tape method', () => {
      setUp();
      chooseMethod('NAVY');

      expect(component.requirements()).toMatchObject({ sex: true, age: false, height: true });
    });

    it('should ask for age but not height under a caliper method', () => {
      setUp();
      chooseMethod('JP7');

      expect(component.requirements()).toMatchObject({ sex: true, age: true, height: false });
    });

    it('should ask for nothing until a method is chosen', () => {
      setUp();

      expect(component.requirements()).toMatchObject({ sex: false, age: false, height: false });
    });

    // Switching away hides a field; it must not throw the value away, or switching back would
    // silently have cleared a birth date the user already gave.
    it('should keep a hidden value so switching back finds it', () => {
      setUp({ dateOfBirth: '1994-03-04' });
      chooseMethod('NAVY');

      expect(component.requirements().age).toBe(false);
      expect(saved().dateOfBirth).toBe('1994-03-04');
    });
  });

  describe('the manual method', () => {
    it('should tick and lock the body-fat field without a variant', () => {
      setUp();
      chooseMethod('MANUAL', null);

      expect(component.isTracked('BODY_FAT')).toBe(true);
      expect(component.isReadByMethod('BODY_FAT')).toBe(true);
      expect(component.requirements()).toMatchObject({ sex: false, age: false, height: false });
    });

    it('should still require a sex for a formula method', () => {
      setUp();
      chooseMethod('NAVY', null);

      expect(component.requirements().sex).toBe(true);
      expect(component.isReadByMethod('WAIST')).toBe(false);
    });

    it('should list the body-fat row only while Manual is chosen', () => {
      setUp();
      chooseMethod('MANUAL', null);
      expect(listed()).toContain('BODY_FAT');

      chooseMethod('NAVY', 'MALE');
      expect(listed()).not.toContain('BODY_FAT');

      chooseMethod('JP7', 'MALE');
      expect(listed()).not.toContain('BODY_FAT');
    });

    it('should not offer the body-fat row before a method is chosen', () => {
      setUp();

      expect(listed()).not.toContain('BODY_FAT');
    });

    it('should drop the body-fat field when a formula method takes over', () => {
      setUp();
      chooseMethod('MANUAL', null);
      chooseMethod('NAVY', 'MALE');

      // Nothing derives from a typed-in figure, and the tape method computes its own. Leaving it
      // tracked would put two body-fat lines on one chart, from instruments that disagree.
      expect(component.isReadByMethod('BODY_FAT')).toBe(false);
      expect(component.isTracked('BODY_FAT')).toBe(false);
      expect(saved().trackedTypes).not.toContain('BODY_FAT');
    });
  });

  describe('switching method', () => {
    it('should release the old formula\'s tape inputs without unticking them', () => {
      setUp();
      chooseMethod('NAVY');
      chooseMethod('JP7');

      // Someone who measured their neck for a year does not stop wanting to see it.
      expect(component.isTracked('NECK')).toBe(true);
      expect(component.isReadByMethod('NECK')).toBe(false);
    });

    it('should drop the caliper sites the new method does not read', () => {
      setUp({ trackedTypes: ['BODY_WEIGHT', 'SKINFOLD_TRICEPS'] });
      chooseMethod('NAVY');

      // No tape method reads a skinfold, and a hidden tick would be charted with no control to
      // turn it off.
      expect(component.isTracked('SKINFOLD_TRICEPS')).toBe(false);
      expect(saved().trackedTypes).not.toContain('SKINFOLD_TRICEPS');
    });

    it('should keep only the sites Jackson-Pollock 3 reads', () => {
      setUp();
      chooseMethod('JP7');
      expect(listed()).toContain('SKINFOLD_MIDAXILLARY');

      chooseMethod('JP3');

      expect(listed()).toContain('SKINFOLD_CHEST');
      expect(listed()).not.toContain('SKINFOLD_MIDAXILLARY');
      expect(saved().trackedTypes).not.toContain('SKINFOLD_MIDAXILLARY');
    });
  });

  /**
   * "Off" is one of the options, so there is always an answer and tapping the chosen chip again
   * means nothing. Material deselects it regardless, and an unchanged model will not put it back.
   */
  describe('the reminder cadence', () => {
    const userToggle = (selected: boolean) =>
      ({ isUserInput: true, source: { selected } }) as MatChipSelectionChange;

    it('should take a newly chosen cadence', () => {
      setUp();

      component.onFrequencySelected(7, userToggle(true));

      expect(saved().frequencyDays).toBe(7);
    });

    it('should put the chip back when the chosen one is tapped again', () => {
      setUp({ frequencyDays: 7 });
      const event = userToggle(false);

      component.onFrequencySelected(7, event);

      expect(event.source.selected).toBe(true);
      expect(saved().frequencyDays).toBe(7);
    });

    it('should ignore a programmatic change, which is how the restore re-enters', () => {
      setUp({ frequencyDays: 7 });

      component.onFrequencySelected(14, { isUserInput: false } as MatChipSelectionChange);

      expect(saved().frequencyDays).toBe(7);
    });
  });

  describe('the checklist', () => {
    it('should offer no caliper rows until a caliper method is chosen', () => {
      setUp();
      chooseMethod('NAVY');

      expect(listed().filter(type => type.startsWith('SKINFOLD_'))).toEqual([]);
    });

    // The chip row reads off the same list, and a checklist that disagreed with it would be noise.
    it('should list the caliper sites in catalog order', () => {
      setUp();
      chooseMethod('JP7');

      expect(listed().filter(type => type.startsWith('SKINFOLD_'))).toEqual([
        'SKINFOLD_CHEST',
        'SKINFOLD_ABDOMEN',
        'SKINFOLD_THIGH',
        'SKINFOLD_TRICEPS',
        'SKINFOLD_SUBSCAPULAR',
        'SKINFOLD_SUPRAILIAC',
        'SKINFOLD_MIDAXILLARY',
      ]);
    });

    it('should let a measurement no formula reads be ticked and unticked freely', () => {
      setUp();
      chooseMethod('NAVY');

      component.onTrackedToggled('BICEPS');
      expect(component.isTracked('BICEPS')).toBe(true);

      component.onTrackedToggled('BICEPS');
      expect(component.isTracked('BICEPS')).toBe(false);
    });
  });
});
