import { z } from 'zod';
import type { Context } from 'hono';
import { createErrorDataWithLogging, createSuccessData, handleRepositoryError } from '../../utils/api-helpers.ts';
import type { TrainingPlanExerciseSetDto, UpdateTrainingPlanExerciseSetCommand } from '../../models/api-types.ts';
import type { AppContext } from '../../context.ts';
import { validateCommandBody, validatePathParams } from "../../utils/validation.ts";

const PATH_SCHEMA = z.object({
  planId: z.string().uuid('Invalid planId format'),
  dayId: z.string().uuid('Invalid dayId format'),
  exerciseId: z.string().uuid('Invalid exerciseId format'),
  setId: z.string().uuid('Invalid setId format'),
});

const COMMAND_SCHEMA = z.object({
  expected_reps: z.number().int().positive('Expected reps must be a positive integer').optional(),
  expected_weight: z.number().nonnegative('Expected weight must be non-negative').optional(),
  set_index: z.number().int().positive('Set index must be positive').optional(),
}).refine(data => Object.keys(data).length > 0, {
  message: 'At least one field must be provided for update',
});

export async function handlePutTrainingPlanExerciseSetById(c: Context<AppContext>) {
  const { path, error: pathError } = validatePathParams(c, PATH_SCHEMA);
  if (pathError) return pathError;

  const { command, error: commandError } = await validateCommandBody<typeof COMMAND_SCHEMA, UpdateTrainingPlanExerciseSetCommand>(c, COMMAND_SCHEMA);
  if (commandError) return commandError;

  const planRepository = c.get('planRepository');

  try {
    const updatedSet = await planRepository.updateSet(path!.planId, path!.dayId, path!.exerciseId, path!.setId, command!);

    if (!updatedSet) {
      const errorData = createErrorDataWithLogging(404, 'Training plan exercise set not found for update.');
      return c.json(errorData, 404);
    }

    const successData = createSuccessData<TrainingPlanExerciseSetDto>(updatedSet);
    return c.json(successData, 200);
  } catch (error) {
    const fallbackMessage = 'Failed to update training plan exercise set';
    return handleRepositoryError(c, error as Error, planRepository.handlePlanOwnershipError, handlePutTrainingPlanExerciseSetById.name, fallbackMessage);
  }
}
