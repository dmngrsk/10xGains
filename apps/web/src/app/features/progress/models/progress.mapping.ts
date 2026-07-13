import { ExerciseProgressDto, PlanDto } from '@txg/shared';
import { subMonths } from 'date-fns';
import { ExerciseSeriesViewModel, ProgressDateRangePreset } from './progress-page.viewmodel';

const SERIES_COLOR_COUNT = 10;

/**
 * The custom properties holding the categorical palette for exercise series; the colors
 * themselves live in `styles.scss` next to the rest of the design tokens.
 */
export const SERIES_COLOR_TOKENS = Array.from(
  { length: SERIES_COLOR_COUNT },
  (_, index) => `--txg-chart-series-${index + 1}`
);

export const DATE_RANGE_PRESET_LABELS: Record<ProgressDateRangePreset, string> = {
  '3M': 'Last 3 months',
  '6M': 'Last 6 months',
  '1Y': 'Last year',
  'ALL': 'All time',
};

/**
 * Converts a date range preset to the inclusive lower bound sent to the API.
 * Returns undefined for 'ALL', which means no lower bound.
 */
export function presetToDateFrom(preset: ProgressDateRangePreset, now: Date): string | undefined {
  switch (preset) {
    case '3M':
      return subMonths(now, 3).toISOString();
    case '6M':
      return subMonths(now, 6).toISOString();
    case '1Y':
      return subMonths(now, 12).toISOString();
    case 'ALL':
      return undefined;
  }
}

/**
 * Formats the reps of every set of one exercise in one session.
 *
 * A uniform session collapses to "sets x reps" (e.g. "5x5"); anything else is listed set
 * by set so failed sets stay visible (e.g. "5/5/4/0/0").
 */
export function formatRepsLabel(reps: number[]): string {
  if (reps.length === 0) {
    return '';
  }

  const isUniform = reps.every(r => r === reps[0]);
  return isUniform ? `${reps.length}x${reps[0]}` : reps.join('/');
}

/**
 * Maps aggregated progress DTOs to chart series view models.
 *
 * Color tokens are assigned by series position (the API returns series sorted by
 * exercise name), so they stay stable while toggling visibility. Plan names
 * are resolved per point for the tooltip; selection is decided by the caller.
 *
 * @param dtos Aggregated series from the API.
 * @param plans All user plans, used to resolve plan names.
 * @param isSelected Predicate deciding the initial selection of each series.
 */
export function mapToExerciseSeriesViewModels(
  dtos: ExerciseProgressDto[],
  plans: PlanDto[],
  isSelected: (exerciseId: string) => boolean
): ExerciseSeriesViewModel[] {
  const planNames = new Map(plans.map(p => [p.id, p.name]));

  return dtos.map((dto, index) => ({
    exerciseId: dto.exercise_id,
    exerciseName: dto.exercise_name,
    colorToken: SERIES_COLOR_TOKENS[index % SERIES_COLOR_TOKENS.length],
    selected: isSelected(dto.exercise_id),
    points: dto.points.map(point => ({
      date: point.session_date,
      weight: point.top_weight,
      repsLabel: formatRepsLabel(point.reps),
      planName: planNames.get(point.plan_id) ?? 'Unknown plan',
    })),
  }));
}
