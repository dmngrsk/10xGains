import { z } from 'zod';
import type { Context } from 'hono';
import { createErrorDataWithLogging, createSuccessData, handleRepositoryError } from '../../utils/api-helpers.ts';
import type { ExerciseDto } from '../../models/api.types.ts';
import type { AppContext } from '../../context.ts';
import { validatePathParams } from "../../utils/validation.ts";

const PATH_SCHEMA = z.object({
  exerciseId: z.string().uuid('Invalid exerciseId format'),
});

export async function handleGetExerciseById(c: Context<AppContext>) {
  const { path, error: pathError } = validatePathParams(c, PATH_SCHEMA);
  if (pathError) return pathError;

  const exerciseRepository = c.get('exerciseRepository');

  try {
    const exercise = await exerciseRepository.findById(path!.exerciseId);

    if (!exercise) {
      const errorData = createErrorDataWithLogging(404, 'Exercise not found');
      return c.json(errorData, 404);
    }

    const successData = createSuccessData<ExerciseDto>(exercise);
    return c.json(successData, 200);
  } catch (e) {
    const fallbackMessage = 'Failed to get exercise';
    return handleRepositoryError(c, e as Error, exerciseRepository.handleExerciseError, handleGetExerciseById.name, fallbackMessage);
  }
}
