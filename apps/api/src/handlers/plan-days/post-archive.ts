import { z } from 'zod';
import type { Context } from 'hono';
import { createErrorDataWithLogging, createSuccessData, handleRepositoryError } from '../../utils/api-helpers';
import type { ArchivePlanDayCommand, PlanDayDto } from '@txg/shared';
import type { AppContext } from '../../context';
import { validateCommandBody, validatePathParams } from "../../utils/validation";

const PATH_SCHEMA = z.object({
  planId: z.string().uuid('Invalid planId format'),
  dayId: z.string().uuid('Invalid dayId format'),
});

const COMMAND_SCHEMA = z.object({
  archived: z.boolean(),
});

export async function handleArchivePlanDay(c: Context<AppContext>) {
  const { path, error: pathError } = validatePathParams(c, PATH_SCHEMA);
  if (pathError) return pathError;

  const { command, error: commandError } = await validateCommandBody<typeof COMMAND_SCHEMA, ArchivePlanDayCommand>(c, COMMAND_SCHEMA);
  if (commandError) return commandError;

  const planRepository = c.get('planRepository');

  try {
    const day = await planRepository.archiveDay(path!.planId, path!.dayId, command!.archived);

    if (!day) {
      const errorData = createErrorDataWithLogging(404, 'Plan day not found.');
      return c.json(errorData, 404);
    }

    const successData = createSuccessData<PlanDayDto>(day);
    return c.json(successData, 200);
  } catch (error) {
    const fallbackMessage = 'Failed to archive plan day';
    return handleRepositoryError(c, error as Error, handleArchivePlanDay.name, fallbackMessage);
  }
}
