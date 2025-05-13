import type { ApiHandlerContext } from '@shared/api-handler.ts';
import { createErrorResponse, createSuccessResponse } from '@shared/api-helpers.ts';
import { z } from 'zod';
import type { ExerciseDto } from '@shared/api-types.ts';

const DEFAULT_PAGE_LIMIT = 20;
const MAX_PAGE_LIMIT = 100;
const DEFAULT_SORT_COLUMN = 'name';
const DEFAULT_SORT_DIRECTION = 'asc';

const ExercisesQuerySchema = z.object({
  limit: z.preprocess(
    (val) => (val ? parseInt(String(val), 10) : DEFAULT_PAGE_LIMIT),
    z.number().int().min(1).max(MAX_PAGE_LIMIT).default(DEFAULT_PAGE_LIMIT)
  ),
  offset: z.preprocess(
    (val) => (val ? parseInt(String(val), 10) : 0),
    z.number().int().min(0).default(0)
  ),
  sort: z.preprocess(
    (val) => (val ? String(val) : `${DEFAULT_SORT_COLUMN}.${DEFAULT_SORT_DIRECTION}`),
    z.string().regex(/^[a-zA-Z_]+.(asc|desc)$/, {
      message: 'Sort parameter must be in format column_name.(asc|desc)'
    }).default(`${DEFAULT_SORT_COLUMN}.${DEFAULT_SORT_DIRECTION}`)
  )
});

export async function handleGetExercises(
  { url, supabaseClient }: Pick<ApiHandlerContext, 'url' | 'supabaseClient'>
) {
  const queryParams = {
    limit: url.searchParams.get('limit'),
    offset: url.searchParams.get('offset'),
    sort: url.searchParams.get('sort')
  };

  const validationResult = ExercisesQuerySchema.safeParse(queryParams);

  if (!validationResult.success) {
    console.error('Query parameters validation error:', validationResult.error.flatten());
    return createErrorResponse(400, 'Invalid query parameters', validationResult.error.flatten().fieldErrors);
  }

  const { limit, offset, sort } = validationResult.data;
  const [sortColumn, sortDirection] = sort.split('.') as [string, 'asc' | 'desc'];

  try {
    const { data, error } = await supabaseClient
      .from('exercises')
      .select('*')
      .range(offset, offset + limit - 1)
      .order(sortColumn, { ascending: sortDirection === 'asc' });

    if (error) {
      console.error('Error fetching exercises:', error);
      return createErrorResponse(500, 'Failed to fetch exercises', { details: error.message });
    }

    return createSuccessResponse<ExerciseDto[]>(200, data);
  } catch (e) {
    console.error('Unexpected error in handleGetExercises:', e);
    return createErrorResponse(500, 'An unexpected error occurred', { details: (e as Error).message });
  }
}
