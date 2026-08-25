import { z } from 'zod';
import type { Context } from 'hono';
import { createErrorDataWithLogging, createSuccessData, handleRepositoryError } from '../../utils/api-helpers';
import type { ArchivePlanExerciseCommand, PlanExerciseDto } from '@txg/shared';
import type { AppContext } from '../../context';
import { validateCommandBody, validatePathParams } from "../../utils/validation";

const PATH_SCHEMA = z.object({
  planId: z.string().uuid('Invalid planId format'),
  dayId: z.string().uuid('Invalid dayId format'),
  exerciseId: z.string().uuid('Invalid exerciseId format'),
});

const COMMAND_SCHEMA = z.object({
  archived: z.boolean(),
});

export async function handleArchivePlanExercise(c: Context<AppContext>) {
  const { path, error: pathError } = validatePathParams(c, PATH_SCHEMA);
  if (pathError) return pathError;

  const { command, error: commandError } = await validateCommandBody<typeof COMMAND_SCHEMA, ArchivePlanExerciseCommand>(c, COMMAND_SCHEMA);
  if (commandError) return commandError;

  const planRepository = c.get('planRepository');

  try {
    const exercise = await planRepository.archiveExercise(path!.planId, path!.dayId, path!.exerciseId, command!.archived);

    if (!exercise) {
      const errorData = createErrorDataWithLogging(404, 'Plan exercise not found.');
      return c.json(errorData, 404);
    }

    const successData = createSuccessData<PlanExerciseDto>(exercise);
    return c.json(successData, 200);
  } catch (error) {
    const fallbackMessage = 'Failed to archive plan exercise';
    return handleRepositoryError(c, error as Error, handleArchivePlanExercise.name, fallbackMessage);
  }
}
