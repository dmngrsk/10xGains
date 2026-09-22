import { DateRangeValue } from '@shared/utils/dates/date-range-presets';
import type { MeasurementUnit } from './measurement-catalog';
import type { MeasurementType } from '@txg/shared';

/** One point on the measurement chart. */
export interface MeasurementPointViewModel {
  date: string;   // ISO date (x)
  value: number;  // in the series' unit (y)
  carriedForward: boolean; // true when a derived point reused an input measured on an earlier date
}

/**
 * A series identity.
 *
 * `MEASURED` series are rows; `ESTIMATED` series are computed per request and never stored, which
 * is why an estimate is keyed by method rather than by measurement type.
 */
export type MeasurementSeriesKind = 'MEASURED' | 'ESTIMATED';

export interface MeasurementSeriesViewModel {
  id: string;
  kind: MeasurementSeriesKind;
  label: string;
  shortLabel: string;
  unit: MeasurementUnit;
  precision: number;
  colorToken: string;
  selected: boolean;
  points: MeasurementPointViewModel[];
}

export interface MeasurementFiltersViewModel {
  dateRange: DateRangeValue;
}

export interface MeasurementsViewModel {
  series: MeasurementSeriesViewModel[];
  filters: MeasurementFiltersViewModel;
  estimateBlockedReason: string | null;
  hasAnyMeasurement: boolean;
  isLoading: boolean;
  error: string | null;
}

/** The last value recorded per type, used to prefill the log dialog. */
export type LastMeasurementValues = Partial<Record<MeasurementType, { value: number; measuredOn: string }>>;

export interface LogMeasurementDialogData {
  types: MeasurementType[];
  lastValues: LastMeasurementValues;
}

