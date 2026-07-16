import { ExerciseProgressDto, PlanDto } from '@txg/shared';
import { ExerciseSeriesViewModel } from './progress-page.viewmodel';

const SERIES_COLOR_COUNT = 10;

/**
 * The custom properties holding the categorical palette for exercise series; the colors
 * themselves live in `styles.scss` next to the rest of the design tokens.
 */
export const SERIES_COLOR_TOKENS = Array.from(
  { length: SERIES_COLOR_COUNT },
  (_, index) => `--txg-chart-series-${index + 1}`
);

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
 * Ranks exercises by their first appearance in the given plans
 * (plans oldest to newest, then day and exercise order).
 */
function buildPlanAppearanceRank(plans: PlanDto[]): Map<string, number> {
  const rank = new Map<string, number>();
  const plansOldestFirst = [...plans].sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? ''));

  for (const plan of plansOldestFirst) {
    const days = [...(plan.days ?? [])].sort((a, b) => a.order_index - b.order_index);
    for (const day of days) {
      const exercises = [...(day.exercises ?? [])].sort((a, b) => a.order_index - b.order_index);
      for (const exercise of exercises) {
        if (!rank.has(exercise.exercise_id)) {
          rank.set(exercise.exercise_id, rank.size);
        }
      }
    }
  }

  return rank;
}

/**
 * Maps aggregated progress DTOs to chart series view models, ordered by exercise
 * appearance in the plans; exercises in no plan keep the API's alphabetical order,
 * last. Color tokens are assigned by series position, so they stay stable while
 * toggling visibility.
 *
 * @param dtos Aggregated series from the API.
 * @param plans All user plans, used to resolve plan names and appearance order.
 * @param isSelected Predicate deciding the initial selection of each series.
 * @param selectedPlanId When set, only that plan defines the appearance order.
 */
export function mapToExerciseSeriesViewModels(
  dtos: ExerciseProgressDto[],
  plans: PlanDto[],
  isSelected: (exerciseId: string) => boolean,
  selectedPlanId: string | null = null
): ExerciseSeriesViewModel[] {
  const planNames = new Map(plans.map(p => [p.id, p.name]));
  const rankSource = selectedPlanId ? plans.filter(p => p.id === selectedPlanId) : plans;
  const appearanceRank = buildPlanAppearanceRank(rankSource);
  const rankOf = (exerciseId: string) => appearanceRank.get(exerciseId) ?? Number.MAX_SAFE_INTEGER;

  const sortedDtos = [...dtos].sort((a, b) => rankOf(a.exercise_id) - rankOf(b.exercise_id));

  return sortedDtos.map((dto, index) => ({
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
