import { z } from 'zod';
import type { Context } from 'hono';
import { handleRepositoryError } from '../../utils/api-helpers.ts';
import type { AppContext } from '../../context.ts';
import { validatePathParams } from "../../utils/validation.ts";

const PATH_SCHEMA = z.object({
  exerciseId: z.string().uuid('Invalid exerciseId format'),
});

export async function handleDeleteExerciseById(c: Context<AppContext>) {
  const { path, error: pathError } = validatePathParams(c, PATH_SCHEMA);
  if (pathError) return pathError;

  const exerciseRepository = c.get('exerciseRepository');

  try {
    await exerciseRepository.delete(path!.exerciseId);

    return c.body(null, 204);
  } catch (e) {
    const fallbackMessage = 'Failed to delete exercise';
    return handleRepositoryError(c, e as Error, exerciseRepository.handleExerciseError, handleDeleteExerciseById.name, fallbackMessage);
  }
}
