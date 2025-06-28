import { z } from 'zod';
import type { Context } from 'hono';
import { createErrorDataWithLogging, createSuccessData, handleRepositoryError } from '../../utils/api-helpers.ts';
import type { UpdateTrainingPlanExerciseCommand } from '../../models/api-types.ts';
import type { AppContext } from '../../context.ts';
import { validateCommandBody, validatePathParams } from "../../utils/validation.ts";

const PATH_SCHEMA = z.object({
  planId: z.string().uuid('Invalid planId format'),
  dayId: z.string().uuid('Invalid dayId format'),
  exerciseId: z.string().uuid('Invalid exerciseId format'),
});

const COMMAND_SCHEMA = z.object({
  order_index: z.number().int().positive('Order index must be a positive integer'),
});

export async function handlePutTrainingPlanExerciseById(c: Context<AppContext>) {
  const { path, error: pathError } = validatePathParams(c, PATH_SCHEMA);
  if (pathError) return pathError;

  const { command, error: commandError } = await validateCommandBody<typeof COMMAND_SCHEMA, UpdateTrainingPlanExerciseCommand>(c, COMMAND_SCHEMA);
  if (commandError) return commandError;

  const planRepository = c.get('planRepository');

  try {
    const updatedExercise = await planRepository.updateExercise(path!.planId, path!.dayId, path!.exerciseId, command!);

    if (!updatedExercise) {
      const errorData = createErrorDataWithLogging(404, 'Training plan exercise not found for update.');
      return c.json(errorData, 404);
    }

    const successData = createSuccessData(updatedExercise);
    return c.json(successData, 200);
  } catch (error) {
    const fallbackMessage = 'Failed to update training plan exercise';
    return handleRepositoryError(c, error as Error, planRepository.handlePlanOwnershipError, handlePutTrainingPlanExerciseById.name, fallbackMessage);
  }
}
