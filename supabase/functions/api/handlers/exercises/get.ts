import { z } from 'zod';
import type { Context } from 'hono';
import { createErrorDataWithLogging, createSuccessData } from '../../utils/api-helpers.ts';
import type { ExerciseDto } from '../../models/api-types.ts';
import type { AppContext } from '../../context.ts';
import { validateQueryParams } from "../../utils/validation.ts";

const DEFAULT_PAGE_LIMIT = 20;
const MAX_PAGE_LIMIT = 100;
const DEFAULT_SORT_COLUMN = 'name';
const DEFAULT_SORT_DIRECTION = 'asc';

const QUERY_SCHEMA = z.object({
  limit: z.preprocess(
    (val: unknown) => (val ? parseInt(String(val), 10) : DEFAULT_PAGE_LIMIT),
    z.number().int().min(1).max(MAX_PAGE_LIMIT).default(DEFAULT_PAGE_LIMIT)
  ),
  offset: z.preprocess(
    (val: unknown) => (val ? parseInt(String(val), 10) : 0),
    z.number().int().min(0).default(0)
  ),
  sort: z.preprocess(
    (val: unknown) => (val ? String(val) : `${DEFAULT_SORT_COLUMN}.${DEFAULT_SORT_DIRECTION}`),
    z.string().regex(/^[a-zA-Z_]+\.(asc|desc)$/, {
      message: 'Sort parameter must be in format column_name.(asc|desc)'
    }).default(`${DEFAULT_SORT_COLUMN}.${DEFAULT_SORT_DIRECTION}`)
  )
});

export async function handleGetExercises(c: Context<AppContext>) {
  const { query, error: queryError } = validateQueryParams(c, QUERY_SCHEMA);
  if (queryError) return queryError;

  const supabaseClient = c.get('supabase');

  try {
    const [sortColumn, sortDirection] = query!.sort.split('.') as [string, 'asc' | 'desc'];
    const { data, count, error } = await supabaseClient
      .from('exercises')
      .select('*', { count: 'exact' })
      .range(query!.offset, query!.offset + query!.limit - 1)
      .order(sortColumn, { ascending: sortDirection === 'asc' });

    if (error) {
      console.error('Error fetching exercises:', error);
      const errorData = createErrorDataWithLogging(500, 'Failed to fetch exercises', { details: error.message });
      return c.json(errorData, 500);
    }

    const successData = createSuccessData<ExerciseDto[]>(data, { totalCount: count ?? undefined });
    return c.json(successData, 200);
  } catch (e) {
    console.error('Unexpected error in handleGetExercises:', e);
    const errorData = createErrorDataWithLogging(500, 'An unexpected error occurred', { details: (e as Error).message });
    return c.json(errorData, 500);
  }
}
