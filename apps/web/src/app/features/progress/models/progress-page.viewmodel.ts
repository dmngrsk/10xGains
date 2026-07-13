export type ProgressDateRangePreset = '3M' | '6M' | '1Y' | 'ALL';

export interface ProgressFilterPlan {
  id: string;
  name: string;
}

export interface ProgressChartPointViewModel {
  date: string; // ISO datetime (x)
  weight: number; // kg (y)
  repsLabel: string; // reps of every set, e.g. "5x5" or "5/5/4/0/0"
  planName: string;
}

export interface ExerciseSeriesViewModel {
  exerciseId: string;
  exerciseName: string;
  colorToken: string; // CSS custom property holding the series color, e.g. --txg-chart-series-1
  selected: boolean;
  points: ProgressChartPointViewModel[];
}

export interface ProgressFiltersViewModel {
  selectedPlanId: string | null; // null = all plans
  dateRangePreset: ProgressDateRangePreset;
  availablePlans: ProgressFilterPlan[];
}

export interface ProgressPageViewModel {
  series: ExerciseSeriesViewModel[];
  filters: ProgressFiltersViewModel;
  isLoading: boolean;
  error: string | null;
}
