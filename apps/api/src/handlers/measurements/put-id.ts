import { z } from 'zod';
import type { Context } from 'hono';
import type { MeasurementDto, UpdateMeasurementCommand } from '@txg/shared';
import { createSuccessData, handleRepositoryError } from '../../utils/api-helpers';
import type { AppContext } from '../../context';
import { validateCommandBody, validatePathParams } from '../../utils/validation';

const PATH_SCHEMA = z.object({
  measurementId: z.string().uuid('Invalid measurementId format'),
});

const COMMAND_SCHEMA = z.object({
  value: z.number().positive('Value must be greater than zero').max(9999.999),
});

export async function handleUpdateMeasurementById(c: Context<AppContext>) {
  const { path, error: pathError } = validatePathParams(c, PATH_SCHEMA);
  if (pathError) return pathError;

  const { command, error: commandError } =
    await validateCommandBody<typeof COMMAND_SCHEMA, UpdateMeasurementCommand>(c, COMMAND_SCHEMA);
  if (commandError) return commandError;

  const measurementRepository = c.get('measurementRepository');

  try {
    const updated = await measurementRepository.update(path!.measurementId, command!);

    const successData = createSuccessData<MeasurementDto>(updated);
    return c.json(successData, 200);
  } catch (error) {
    const fallbackMessage = 'Failed to update measurement';
    return handleRepositoryError(c, error as Error, handleUpdateMeasurementById.name, fallbackMessage);
  }
}
