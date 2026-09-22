import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges, inject } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipSelectionChange, MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import {
  MEASUREMENT_TYPES,
  SKINFOLD_MEASUREMENT_TYPES,
} from '@txg/shared';
import {
  BODY_FAT_METHOD_REQUIREMENTS,
  MEASUREMENT_TYPE_META,
  NO_BODY_FAT_METHOD_REQUIREMENTS,
} from '@features/measurements/models/measurement-catalog';
import type { BodyFatMethodRequirements } from '@features/measurements/models/measurement-catalog';
import { MEASUREMENT_INSTRUMENT_HINTS, groupByInstrument, resolveTrackedTypes } from '@features/measurements/models/measurements.mapping';
import { MeasurementsSettingsCardViewModel } from '../../../../models/settings-page.viewmodel';
import type { BodyFatMethod, Sex, MeasurementType } from '@txg/shared';

export interface MeasurementsSettingsSaved {
  heightCm: number | null;
  dateOfBirth: string | null;
  bodyFatMethod: BodyFatMethod | null;
  sex: Sex | null;
  frequencyDays: number | null;
  trackedTypes: MeasurementType[];
}

const METHOD_ONLY_TYPES: readonly MeasurementType[] = [...SKINFOLD_MEASUREMENT_TYPES, 'BODY_FAT'];

interface TrackableType {
  type: MeasurementType;
  label: string;
  unit: string;
}

interface TrackableGroup {
  label: string;
  hint: string;
  types: TrackableType[];
}

interface FrequencyOption {
  label: string;
  days: number | null;
}

@Component({
  selector: 'txg-measurements-settings-card',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatCheckboxModule,
    MatChipsModule,
    MatDividerModule,
    MatIconModule,
  ],
  templateUrl: './measurements-settings-card.component.html',
})
export class MeasurementsSettingsCardComponent implements OnInit, OnChanges {
  private readonly fb = inject(FormBuilder);

  @Input() measurements!: MeasurementsSettingsCardViewModel;
  @Output() measurementsSaved = new EventEmitter<MeasurementsSettingsSaved>();

  form!: FormGroup;
  tracked = new Set<MeasurementType>();

  private readonly allGroups: TrackableGroup[] = [
    ...groupByInstrument(MEASUREMENT_TYPES).map(group => ({
      label: group.instrument,
      hint: MEASUREMENT_INSTRUMENT_HINTS[group.instrument],
      types: toTrackable(group.types),
    })),
  ];

  readonly frequencyOptions: FrequencyOption[] = [
    { label: 'Off', days: null },
    { label: 'Weekly', days: 7 },
    { label: 'Fortnightly', days: 14 },
    { label: 'Monthly', days: 28 },
  ];

  ngOnInit(): void {
    this.form = this.fb.group({
      frequencyDays: [this.measurements?.frequencyDays ?? null],
      heightCm: [this.measurements?.heightCm ?? null, [Validators.min(50), Validators.max(300)]],
      dateOfBirth: [this.measurements?.dateOfBirth ?? null],
      bodyFatMethod: [this.measurements?.bodyFatMethod ?? null],
      sex: [this.measurements?.sex ?? null],
    });
    this.seedTracked();
  }

  isTracked(type: MeasurementType): boolean {
    return this.tracked.has(type);
  }

  onTrackedToggled(type: MeasurementType): void {
    if (this.isReadByMethod(type)) {
      return;
    }

    if (this.tracked.has(type)) {
      this.tracked.delete(type);
    } else {
      this.tracked.add(type);
    }
    this.form.markAsDirty();
  }

  visibleGroups(): TrackableGroup[] {
    const readByMethod = this.methodInputTypes();

    return this.allGroups
      .map(group => ({
        ...group,
        types: group.types.filter(item =>
          !METHOD_ONLY_TYPES.includes(item.type) || readByMethod.includes(item.type)),
      }))
      .filter(group => group.types.length > 0);
  }

  methodInputTypes(): MeasurementType[] {
    const { bodyFatMethod, sex } = this.form.value;
    if (!bodyFatMethod || (this.requirements().sex && !sex)) {
      return [];
    }

    return this.requirements().measurements(sex as Sex);
  }

  requirements(): BodyFatMethodRequirements {
    const method = this.form.value.bodyFatMethod as BodyFatMethod | null;
    return method ? BODY_FAT_METHOD_REQUIREMENTS[method] : NO_BODY_FAT_METHOD_REQUIREMENTS;
  }

  isReadByMethod(type: MeasurementType): boolean {
    return this.methodInputTypes().includes(type);
  }

  onMethodChanged(): void {
    this.syncTrackedToMethod();
    this.form.markAsDirty();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['measurements'] && this.form) {
      this.form.patchValue({
        frequencyDays: this.measurements?.frequencyDays ?? null,
        heightCm: this.measurements?.heightCm ?? null,
        dateOfBirth: this.measurements?.dateOfBirth ?? null,
        bodyFatMethod: this.measurements?.bodyFatMethod ?? null,
        sex: this.measurements?.sex ?? null,
      }, { emitEvent: false });
      this.seedTracked();
      this.form.markAsPristine();
    }
  }

  onFrequencySelected(days: number | null, event: MatChipSelectionChange): void {
    if (!event.isUserInput) {
      return;
    }

    if (!event.source.selected) {
      event.source.selected = true;
      return;
    }

    this.form.get('frequencyDays')?.setValue(days);
    this.form.markAsDirty();
  }

  onSaved(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.value;

    this.measurementsSaved.emit({
      heightCm: toNumberOrNull(value.heightCm),
      dateOfBirth: value.dateOfBirth || null,
      bodyFatMethod: value.bodyFatMethod || null,
      sex: value.sex || null,
      frequencyDays: value.frequencyDays ?? null,
      trackedTypes: [...this.tracked],
    });
    this.form.markAsPristine();
  }

  private seedTracked(): void {
    this.tracked = new Set(resolveTrackedTypes(
      this.measurements?.trackedTypes,
      this.measurements?.loggedTypes ?? []
    ));
    this.syncTrackedToMethod();
  }

  private syncTrackedToMethod(): void {
    const readByMethod = this.methodInputTypes();

    for (const type of METHOD_ONLY_TYPES) {
      if (!readByMethod.includes(type)) {
        this.tracked.delete(type);
      }
    }
    for (const type of readByMethod) {
      this.tracked.add(type);
    }
  }
}

function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || `${value}`.trim() === '') {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function toTrackable(types: MeasurementType[]): TrackableType[] {
  return types.map(type => ({
    type,
    label: MEASUREMENT_TYPE_META[type].label,
    unit: MEASUREMENT_TYPE_META[type].unit,
  }));
}
