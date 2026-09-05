import { CommonModule, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { DateAdapter, MAT_DATE_FORMATS, MAT_NATIVE_DATE_FORMATS, MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTimepickerModule } from '@angular/material/timepicker';
import { MondayFirstDateAdapter } from '@shared/utils/dates/monday-first-date-adapter';
import { formatRetimingShift, previewSessionRetiming } from '../../../utils/session-retiming.utils';

export interface SessionFinishTimeDialogData {
  now: Date;
  sessionDate: Date | null;
  setTimestamps: Date[];
}

@Component({
  selector: 'txg-session-finish-time-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatTimepickerModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  providers: [
    { provide: DateAdapter, useClass: MondayFirstDateAdapter },
    { provide: MAT_DATE_FORMATS, useValue: MAT_NATIVE_DATE_FORMATS },
    DatePipe,
  ],
  templateUrl: './session-finish-time-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SessionFinishTimeDialogComponent {
  private static readonly TIME_INTERVAL_MINUTES = 5;

  private readonly fb = inject(FormBuilder);
  private readonly datePipe = inject(DatePipe);
  private readonly dialogRef = inject<MatDialogRef<SessionFinishTimeDialogComponent, string>>(MatDialogRef);

  readonly data = inject<SessionFinishTimeDialogData>(MAT_DIALOG_DATA);

  readonly maxDate = this.data.now;

  readonly timeInterval = `${SessionFinishTimeDialogComponent.TIME_INTERVAL_MINUTES}m`;

  readonly form = this.fb.group({
    date: this.fb.control<Date | null>(this.defaultEnd(), Validators.required),
    time: this.fb.control<Date | null>(this.defaultEnd(), Validators.required),
  });

  private readonly endAt = signal<Date | null>(this.defaultEnd());

  readonly isInFuture = computed(() => {
    const endAt = this.endAt();
    return !!endAt && endAt.getTime() > this.data.now.getTime();
  });

  readonly preview = computed(() => {
    const endAt = this.endAt();
    if (!endAt || this.isInFuture()) return null;

    return previewSessionRetiming(this.data.sessionDate, this.data.setTimestamps, endAt);
  });

  readonly recordedAsText = computed(() => {
    const preview = this.preview();
    if (!preview?.start || !preview.end) return null;

    const day = this.datePipe.transform(preview.start, 'EEE, MMM d');
    const start = this.datePipe.transform(preview.start, 'HH:mm');
    const end = this.datePipe.transform(preview.end, 'HH:mm');
    return `${day} · ${start} – ${end}`;
  });

  readonly consequenceText = computed(() => {
    const preview = this.preview();
    const endAt = this.endAt();
    if (!preview || !endAt) return null;

    if (preview.movedCount === 0) {
      return 'Recorded set times are unchanged.';
    }

    const moved = preview.movedCount === 1
      ? '1 set moves'
      : `${preview.keptCount === 0 ? 'All ' : ''}${preview.movedCount} sets move`;
    const shift = `${preview.clamped ? 'up to ' : ''}${formatRetimingShift(preview.shiftMs)}`;

    if (preview.keptCount === 0) {
      return `${moved} back by ${shift}.`;
    }

    const kept = preview.keptCount === 1 ? 'the other set keeps its' : `the other ${preview.keptCount} sets keep their`;
    return `${moved} back by ${shift}; ${kept} recorded time.`;
  });

  constructor() {
    this.form.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.endAt.set(this.combineDateAndTime()));
  }

  onSave(): void {
    const endAt = this.endAt();
    if (!endAt || this.isInFuture()) return;

    this.dialogRef.close(endAt.toISOString());
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  private combineDateAndTime(): Date | null {
    const { date, time } = this.form.getRawValue();
    if (!date || !time || isNaN(date.getTime()) || isNaN(time.getTime())) return null;

    const combined = new Date(date);
    combined.setHours(time.getHours(), time.getMinutes(), 0, 0);
    return combined;
  }

  private defaultEnd(): Date {
    const timestamps = [
      ...this.data.setTimestamps.map(date => date.getTime()),
      ...(this.data.sessionDate ? [this.data.sessionDate.getTime()] : []),
    ];

    const anchor = timestamps.length > 0 ? new Date(Math.max(...timestamps)) : this.data.now;
    const interval = SessionFinishTimeDialogComponent.TIME_INTERVAL_MINUTES;

    const snapped = new Date(anchor);
    snapped.setMinutes(Math.floor(anchor.getMinutes() / interval) * interval, 0, 0);
    return snapped;
  }
}
