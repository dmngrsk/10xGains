import { z } from 'zod';
import type { Context } from 'hono';
import { createSuccessData, handleRepositoryError } from '../../utils/api-helpers.ts';
import type { CreatePlanExerciseCommand } from '../../models/api.types.ts';
import type { AppContext } from '../../context.ts';
import { validateCommandBody, validatePathParams } from "../../utils/validation.ts";

const PATH_SCHEMA = z.object({
  planId: z.string().uuid('Invalid planId format'),
  dayId: z.string().uuid('Invalid dayId format'),
});

const COMMAND_SCHEMA = z.object({
  exercise_id: z.string().uuid('Invalid exerciseId format'),
  order_index: z.number().int().positive('Order index must be a positive integer').optional(),
});

export async function handleCreatePlanExercise(c: Context<AppContext>) {
  const { path, error: pathError } = validatePathParams(c, PATH_SCHEMA);
  if (pathError) return pathError;

  const { command, error: commandError } = await validateCommandBody<typeof COMMAND_SCHEMA, CreatePlanExerciseCommand>(c, COMMAND_SCHEMA);
  if (commandError) return commandError;

  const planRepository = c.get('planRepository');

  try {
    const newExercise = await planRepository.createExercise(path!.planId, path!.dayId, command!);

    const successData = createSuccessData(newExercise);
    return c.json(successData, 201);
  } catch (error) {
    const fallbackMessage = 'Failed to add exercise to plan day';
    const mergedErrorHandler = (error: Error) => planRepository.handleExerciseNotFoundError(error) || planRepository.handlePlanOwnershipError(error);
    return handleRepositoryError(c, error as Error, mergedErrorHandler, handleCreatePlanExercise.name, fallbackMessage);
  }
}
