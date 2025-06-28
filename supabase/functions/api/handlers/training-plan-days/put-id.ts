import { z } from 'zod';
import type { Context } from 'hono';
import { createErrorDataWithLogging, createSuccessData, handleRepositoryError } from '../../utils/api-helpers.ts';
import type { TrainingPlanDayDto, UpdateTrainingPlanDayCommand } from '../../models/api-types.ts';
import type { AppContext } from '../../context.ts';
import { validateCommandBody, validatePathParams } from "../../utils/validation.ts";

const PATH_SCHEMA = z.object({
  planId: z.string().uuid('Invalid planId format'),
  dayId: z.string().uuid('Invalid dayId format'),
});

const COMMAND_SCHEMA = z.object({
  name: z.string().min(1, 'Name cannot be empty if provided').optional(),
  description: z.string().nullable().optional(),
  order_index: z.number().int().positive('Order index must be a positive integer').optional(),
}).refine(data => Object.keys(data).length > 0, {
  message: "Request body must contain at least one field to update"
});

export async function handlePutTrainingPlanDayById(c: Context<AppContext>) {
  const { path, error: pathError } = validatePathParams(c, PATH_SCHEMA);
  if (pathError) return pathError;

  const { command, error: commandError } = await validateCommandBody<typeof COMMAND_SCHEMA, UpdateTrainingPlanDayCommand>(c, COMMAND_SCHEMA);
  if (commandError) return commandError;

  const planRepository = c.get('planRepository');

  try {
    const updatedDay = await planRepository.updateDay(path!.planId, path!.dayId, command!);

    if (!updatedDay) {
      const errorData = createErrorDataWithLogging(404, 'Training plan day not found for update.');
      return c.json(errorData, 404);
    }

    const successData = createSuccessData<TrainingPlanDayDto>(updatedDay);
    return c.json(successData, 200);
  } catch (error) {
    const fallbackMessage = 'Failed to update training plan day';
    return handleRepositoryError(c, error as Error, planRepository.handlePlanOwnershipError, handlePutTrainingPlanDayById.name, fallbackMessage);
  }
}
