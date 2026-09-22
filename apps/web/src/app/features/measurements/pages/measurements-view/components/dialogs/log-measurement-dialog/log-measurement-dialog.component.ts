import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MEASUREMENT_TYPE_META } from '@features/measurements/models/measurement-catalog';
import { MEASUREMENT_INSTRUMENT_HINTS, groupByInstrument } from '@features/measurements/models/measurements.mapping';
import type { MeasurementInstrument } from '@features/measurements/models/measurements.mapping';
import { LogMeasurementDialogData } from '@features/measurements/models/measurements.viewmodel';
import { todayAsCalendarDate } from '@shared/utils/dates/calendar-date';
import type { CreateMeasurementCommand, MeasurementType } from '@txg/shared';

interface FieldViewModel {
  type: MeasurementType;
  shortLabel: string;
  label: string;
  unit: string;
  step: number;
}

interface FieldGroupViewModel {
  instrument: MeasurementInstrument;
  hint: string;
  fields: FieldViewModel[];
}

@Component({
  selector: 'txg-log-measurement-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
  ],
  templateUrl: './log-measurement-dialog.component.html',
  styleUrl: './log-measurement-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LogMeasurementDialogComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly dialogRef = inject<MatDialogRef<LogMeasurementDialogComponent>>(MatDialogRef);
  readonly data = inject<LogMeasurementDialogData>(MAT_DIALOG_DATA);

  readonly form: FormGroup;
  readonly groups: FieldGroupViewModel[];
  readonly allFields: FieldViewModel[];

  constructor() {
    this.groups = groupByInstrument(this.data.types).map(group => ({
      instrument: group.instrument,
      hint: MEASUREMENT_INSTRUMENT_HINTS[group.instrument],
      fields: group.types.map(type => this.toField(type)),
    }));
    this.allFields = this.groups.flatMap(group => group.fields);

    this.form = this.formBuilder.group({
      measuredOn: [todayAsCalendarDate(), Validators.required],
      values: this.formBuilder.array(
        this.allFields.map(field =>
          this.formBuilder.control(this.lastValueFor(field.type), [Validators.min(0.001)])
        )
      ),
    });
  }

  get values(): FormArray {
    return this.form.get('values') as FormArray;
  }

  controlIndex(field: FieldViewModel): number {
    return this.allFields.findIndex(f => f.type === field.type);
  }

  stepFor(field: FieldViewModel): number {
    return field.step;
  }

  adjust(field: FieldViewModel, direction: 1 | -1): void {
    const control = this.values.at(this.controlIndex(field));
    const current = Number(control.value);
    const base = Number.isFinite(current) && current > 0 ? current : 0;
    const stepped = base + direction * field.step;
    const decimals = Math.max(0, Math.round(-Math.log10(field.step)));

    control.setValue(stepped > 0 ? Number(stepped.toFixed(decimals)) : null);
    control.markAsDirty();
  }

  onSave(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const measuredOn = this.form.value.measuredOn as string;

    const commands: CreateMeasurementCommand[] = this.allFields
      .map((field, index) => ({ field, control: this.values.at(index) }))
      .filter(({ control }) => control.dirty)
      .map(({ field, control }) => ({ field, value: control.value as number | null }))
      .filter(({ value }) => value !== null && value !== undefined && `${value}`.trim() !== '' && Number(value) > 0)
      .map(({ field, value }) => ({
        measured_on: measuredOn,
        type: field.type,
        value: Number(value),
      }));

    this.dialogRef.close(commands.length > 0 ? commands : undefined);
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  private toField(type: MeasurementType): FieldViewModel {
    const meta = MEASUREMENT_TYPE_META[type];

    return { type, shortLabel: meta.shortLabel, label: meta.label, unit: meta.unit, step: 10 ** -meta.precision };
  }

  private lastValueFor(type: MeasurementType): number | null {
    const last = this.data.lastValues[type];
    if (last === undefined) {
      return null;
    }

    return Number(last.value.toFixed(MEASUREMENT_TYPE_META[type].precision));
  }
}
