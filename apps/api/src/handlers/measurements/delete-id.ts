import { z } from 'zod';
import type { Context } from 'hono';
import { handleRepositoryError } from '../../utils/api-helpers';
import type { AppContext } from '../../context';
import { validatePathParams } from '../../utils/validation';

const PATH_SCHEMA = z.object({
  measurementId: z.string().uuid('Invalid measurementId format'),
});

export async function handleDeleteMeasurementById(c: Context<AppContext>) {
  const { path, error: pathError } = validatePathParams(c, PATH_SCHEMA);
  if (pathError) return pathError;

  const measurementRepository = c.get('measurementRepository');

  try {
    await measurementRepository.delete(path!.measurementId);

    return c.body(null, 204);
  } catch (error) {
    const fallbackMessage = 'Failed to delete measurement';
    return handleRepositoryError(c, error as Error, handleDeleteMeasurementById.name, fallbackMessage);
  }
}
