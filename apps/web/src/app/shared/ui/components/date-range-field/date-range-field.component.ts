import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, EventEmitter, Input, OnInit, Output, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { DateAdapter, MAT_DATE_FORMATS, MAT_NATIVE_DATE_FORMATS, MatNativeDateModule, NativeDateAdapter } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { DATE_RANGE_PRESET_LABELS, DATE_RANGE_PRESET_ORDER, DateRangePreset, DateRangeValue, presetToRange } from '@shared/utils/dates/date-range-presets';

/**
 * A shared date range field pairing a manual `mat-date-range-input` with a preset menu, opened
 * from an icon button next to the calendar toggle. While a preset is active its label overlays the
 * field in place of the resolved dates; presets set the start date and clear the end. Editing
 * either date by hand deselects the active preset. A picked end date is emitted at end of day so
 * the boundary is inclusive, and a start-after-end range is surfaced through `validityChange` for
 * the host to act on.
 */
@Component({
  selector: 'txg-date-range-field',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatMenuModule,
  ],
  providers: [
    { provide: DateAdapter, useClass: NativeDateAdapter },
    { provide: MAT_DATE_FORMATS, useValue: MAT_NATIVE_DATE_FORMATS },
  ],
  templateUrl: './date-range-field.component.html',
  styleUrl: './date-range-field.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DateRangeFieldComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  @Input()
  set value(value: DateRangeValue | null | undefined) {
    // No value clears the field, rather than silently keeping the previous range.
    if (!value) {
      this.setRange(null, null, null);
      return;
    }

    // A host that feeds `valueChange` back into `value` echoes every keystroke straight back.
    // Re-applying it would rewrite the inputs mid-edit - the date adapter reformats whatever it
    // parsed, so typing "6" would replace the text with "6/1/2001" - so ignore our own value.
    if (!this.isCurrentValue(value)) {
      this.applyValue(value);
    }
  }

  @Output() valueChange = new EventEmitter<DateRangeValue>();
  @Output() validityChange = new EventEmitter<boolean>();

  readonly presets = DATE_RANGE_PRESET_ORDER;
  readonly presetLabels = DATE_RANGE_PRESET_LABELS;
  readonly activePreset = signal<DateRangePreset | null>(null);
  private readonly inputFocused = signal(false);

  /**
   * Whether the preset label should overlay the field. It gives way to the resolved dates while
   * the input is focused, so pressing into the control reveals what the preset would apply.
   */
  readonly showPresetLabel = computed(() => this.activePreset() !== null && !this.inputFocused());

  readonly rangeForm = this.fb.group({
    start: this.fb.control<Date | null>(null),
    end: this.fb.control<Date | null>(null),
  });

  /** Suppresses the change subscription while the value is being set programmatically. */
  private suppressEmit = false;

  ngOnInit(): void {
    this.rangeForm.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      if (this.suppressEmit) {
        return;
      }
      // A manual edit is the only way here, so it always deselects the active preset.
      this.activePreset.set(null);
      this.emit();
    });
  }

  onPresetSelected(preset: DateRangePreset): void {
    // Tapping the active preset is a no-op; a preset is only left by picking another or editing a date.
    if (this.activePreset() === preset) {
      return;
    }

    const range = presetToRange(preset, new Date());
    this.setRange(range.dateFrom, range.dateTo, preset);
    this.emit();
  }

  onInputFocus(): void {
    this.inputFocused.set(true);
  }

  onInputBlur(): void {
    this.inputFocused.set(false);
  }

  private applyValue(value: DateRangeValue): void {
    this.setRange(value.dateFrom, value.dateTo, value.preset);
  }

  private setRange(dateFrom: string | null, dateTo: string | null, preset: DateRangePreset | null): void {
    this.suppressEmit = true;
    this.activePreset.set(preset);
    this.rangeForm.setValue({
      start: toDate(dateFrom),
      end: toDate(dateTo),
    }, { emitEvent: false });
    this.suppressEmit = false;
  }

  private emit(): void {
    this.valueChange.emit(this.currentValue());
    this.validityChange.emit(this.rangeForm.valid);
  }

  /** The value the field currently represents, in the shape it emits. */
  private currentValue(): DateRangeValue {
    const { start, end } = this.rangeForm.getRawValue();
    return {
      preset: this.activePreset(),
      dateFrom: start ? start.toISOString() : null,
      dateTo: end ? toEndOfDay(end).toISOString() : null,
    };
  }

  private isCurrentValue(value: DateRangeValue): boolean {
    const current = this.currentValue();
    return current.preset === value.preset
      && current.dateFrom === value.dateFrom
      && current.dateTo === value.dateTo;
  }
}

/**
 * Parses a bound the host supplied, treating an unparseable one as absent. Keeps the form free of
 * Invalid Dates, which are truthy and would throw a RangeError once read back through toISOString.
 */
function toDate(iso: string | null): Date | null {
  if (!iso) {
    return null;
  }
  const date = new Date(iso);
  return isNaN(date.getTime()) ? null : date;
}

/** Maps a picked date to the last millisecond of its local day, so the boundary day is included. */
function toEndOfDay(date: Date): Date {
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  return endOfDay;
}
