import { z } from 'zod';
import type { Context } from 'hono';
import { createSuccessData, handleRepositoryError } from '../../utils/api-helpers.ts';
import type { TrainingPlanExerciseSetDto, CreateTrainingPlanExerciseSetCommand } from '../../models/api-types.ts';
import type { AppContext } from '../../context.ts';
import { validateCommandBody, validatePathParams } from "../../utils/validation.ts";

const PATH_SCHEMA = z.object({
  planId: z.string().uuid('Invalid planId format'),
  dayId: z.string().uuid('Invalid dayId format'),
  exerciseId: z.string().uuid('Invalid exerciseId format'),
});

const COMMAND_SCHEMA = z.object({
  expected_reps: z.number().int().positive('Expected reps must be a positive integer'),
  expected_weight: z.number().nonnegative('Expected weight must be non-negative'),
  set_index: z.number().int().positive('Set index must be positive').optional(),
});

export async function handleCreateTrainingPlanExerciseSet(c: Context<AppContext>) {
  const { path, error: pathError } = validatePathParams(c, PATH_SCHEMA);
  if (pathError) return pathError;

  const { command, error: commandError } = await validateCommandBody<typeof COMMAND_SCHEMA, CreateTrainingPlanExerciseSetCommand>(c, COMMAND_SCHEMA);
  if (commandError) return commandError;

  const planRepository = c.get('planRepository');

  try {
    const newSet = await planRepository.createSet(path!.planId, path!.dayId, path!.exerciseId, command!);

    const successData = createSuccessData<TrainingPlanExerciseSetDto>(newSet);
    return c.json(successData, 201);
  } catch (error) {
    const fallbackMessage = 'Failed to create training plan exercise set';
    return handleRepositoryError(c, error as Error, planRepository.handlePlanOwnershipError, handleCreateTrainingPlanExerciseSet.name, fallbackMessage);
  }
}
