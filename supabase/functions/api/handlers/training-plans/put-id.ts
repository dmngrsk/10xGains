import { z } from 'zod';
import type { Context } from 'hono';
import { createErrorDataWithLogging, createSuccessData, handleRepositoryError } from '../../utils/api-helpers.ts';
import type { TrainingPlanDto, UpdateTrainingPlanCommand } from '../../models/api-types.ts';
import type { AppContext } from '../../context.ts';
import { validateCommandBody, validatePathParams } from "../../utils/validation.ts";

const PATH_SCHEMA = z.object({
  planId: z.string().uuid('Invalid planId format'),
});

const COMMAND_SCHEMA = z.object({
  name: z.string().min(1, 'Name must not be empty').optional(),
  description: z.string().nullable().optional(),
}).refine(data => Object.keys(data).length > 0, {
  message: "Request body must contain at least one field to update"
});

export async function handlePutTrainingPlanById(c: Context<AppContext>) {
  const { path, error: pathError } = validatePathParams(c, PATH_SCHEMA);
  if (pathError) return pathError;

  const { command, error: commandError } = await validateCommandBody<typeof COMMAND_SCHEMA, UpdateTrainingPlanCommand>(c, COMMAND_SCHEMA);
  if (commandError) return commandError;

  const planRepository = c.get('planRepository');

  try {
    const updatedTrainingPlan = await planRepository.update(path!.planId, command!);

    if (!updatedTrainingPlan) {
      const errorData = createErrorDataWithLogging(404, 'Training plan not found for update');
      return c.json(errorData, 404);
    }

    const successData = createSuccessData<TrainingPlanDto>(updatedTrainingPlan);
    return c.json(successData, 200);
  } catch (e) {
    const fallbackMessage = 'Failed to update training plan';
    return handleRepositoryError(c, e as Error, planRepository.handlePlanOwnershipError, handlePutTrainingPlanById.name, fallbackMessage);
  }
}
