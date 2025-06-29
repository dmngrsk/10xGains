import { z } from 'zod';
import type { Context } from 'hono';
import { createSuccessData, handleRepositoryError } from '../../utils/api-helpers.ts';
import type { ExerciseDto } from '../../models/api.types.ts';
import type { AppContext } from '../../context.ts';
import { validateQueryParams } from "../../utils/validation.ts";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const DEFAULT_OFFSET = 0;
const DEFAULT_SORT_COLUMN = 'name';
const DEFAULT_SORT_DIRECTION = 'asc';

const QUERY_SCHEMA = z.object({
  limit: z.preprocess(
    (val: unknown) => (val ? parseInt(String(val), 10) : DEFAULT_LIMIT),
    z.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT)
  ),
  offset: z.preprocess(
    (val: unknown) => (val ? parseInt(String(val), 10) : DEFAULT_OFFSET),
    z.number().int().min(0).default(DEFAULT_OFFSET)
  ),
  sort: z.preprocess(
    (val: unknown) => (val ? String(val) : `${DEFAULT_SORT_COLUMN}.${DEFAULT_SORT_DIRECTION}`),
    z.string()
      .regex(/^[a-zA-Z_]+\.(asc|desc)$/, 'Sort parameter must be in format column_name.(asc|desc)')
      .default(`${DEFAULT_SORT_COLUMN}.${DEFAULT_SORT_DIRECTION}`)
  )
});

export async function handleGetExercises(c: Context<AppContext>) {
  const { query, error: queryError } = validateQueryParams(c, QUERY_SCHEMA);
  if (queryError) return queryError;

  const exerciseRepository = c.get('exerciseRepository');

  try {
    const queryOptions = { limit: query!.limit, offset: query!.offset, sort: query!.sort };
    const result = await exerciseRepository.findAll(queryOptions);

    const successData = createSuccessData<ExerciseDto[]>(result.data, { totalCount: result.totalCount });
    return c.json(successData, 200);
  } catch (e) {
    const fallbackMessage = 'Failed to get exercises';
    return handleRepositoryError(c, e as Error, exerciseRepository.handleExerciseError, handleGetExercises.name, fallbackMessage);
  }
}
