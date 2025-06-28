import { z } from 'zod';
import type { Context } from 'hono';
import { createSuccessData, handleRepositoryError } from '../../utils/api-helpers.ts';
import type { TrainingPlanExerciseProgressionDto, UpsertTrainingPlanExerciseProgressionCommand } from '../../models/api-types.ts';
import type { AppContext } from '../../context.ts';
import { validateCommandBody, validatePathParams } from "../../utils/validation.ts";

const PATH_SCHEMA = z.object({
  planId: z.string().uuid('Invalid planId format'),
  exerciseId: z.string().uuid('Invalid exerciseId format'),
});

const COMMAND_SCHEMA = z.object({
  weight_increment: z.number().positive().optional(),
  failure_count_for_deload: z.number().int().positive().optional(),
  consecutive_failures: z.number().int().min(0).optional(),
  deload_percentage: z.number().max(100).positive().optional(),
  deload_strategy: z.enum(['PROPORTIONAL', 'REFERENCE_SET', 'CUSTOM']).optional(),
  reference_set_index: z.number().int().min(0).nullable().optional()
}).refine(data => Object.keys(data).length > 0, {
  message: "Request body must contain at least one field to update"
});

export async function handlePutTrainingPlanExerciseProgressionById(c: Context<AppContext>) {
  const { path, error: pathError } = validatePathParams(c, PATH_SCHEMA);
  if (pathError) return pathError;

  const { command, error: commandError } = await validateCommandBody<typeof COMMAND_SCHEMA, UpsertTrainingPlanExerciseProgressionCommand>(c, COMMAND_SCHEMA);
  if (commandError) return commandError;

  const planRepository = c.get('planRepository');

  try {
    const upsertedProgression = await planRepository.upsertProgression(path!.planId, path!.exerciseId, command!);

    const successData = createSuccessData<TrainingPlanExerciseProgressionDto>(upsertedProgression);
    return c.json(successData, 200);
  } catch (error) {
    const fallbackMessage = 'Failed to update training plan exercise progression';
    return handleRepositoryError(c, error as Error, planRepository.handlePlanOwnershipError, handlePutTrainingPlanExerciseProgressionById.name, fallbackMessage);
  }
}
