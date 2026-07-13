import { z } from 'zod';
import type { Context } from 'hono';
import { createSuccessData, handleRepositoryError } from '../../utils/api-helpers';
import type { ExerciseDto } from '@txg/shared';
import type { AppContext } from '../../context';
import { optionalLimit, optionalOffset, optionalSort, validateQueryParams } from "../../utils/validation";

const QUERY_SCHEMA = z.object({
  limit: optionalLimit(),
  offset: optionalOffset(),
  sort: optionalSort('name', 'asc')
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
