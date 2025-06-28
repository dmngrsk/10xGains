import { z } from 'zod';
import type { Context } from 'hono';
import { createSuccessData, handleRepositoryError } from '../../utils/api-helpers.ts';
import type { CreateTrainingPlanDayCommand, TrainingPlanDayDto } from '../../models/api-types.ts';
import type { AppContext } from '../../context.ts';
import { validateCommandBody, validatePathParams } from "../../utils/validation.ts";

const PATH_SCHEMA = z.object({
  planId: z.string().uuid('Invalid planId format'),
});

const COMMAND_SCHEMA = z.object({
  name: z.string().min(1, 'Name is required and cannot be empty'),
  description: z.string().nullable().optional(),
  order_index: z.number().int().positive('Order index must be a positive integer').optional(),
});

export async function handleCreateTrainingPlanDay(c: Context<AppContext>) {
  const { path, error: pathError } = validatePathParams(c, PATH_SCHEMA);
  if (pathError) return pathError;

  const { command, error: commandError } = await validateCommandBody<typeof COMMAND_SCHEMA, CreateTrainingPlanDayCommand>(c, COMMAND_SCHEMA);
  if (commandError) return commandError;

  const planRepository = c.get('planRepository');

  try {
    const newDay = await planRepository.createDay(path!.planId, command!);

    const successData = createSuccessData<TrainingPlanDayDto>(newDay);
    return c.json(successData, 201);
  } catch (error) {
    const fallbackMessage = 'Failed to create training plan day';
    return handleRepositoryError(c, error as Error, planRepository.handlePlanOwnershipError, handleCreateTrainingPlanDay.name, fallbackMessage);
  }
}
