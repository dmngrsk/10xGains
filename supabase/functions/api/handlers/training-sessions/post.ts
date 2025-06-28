import { z } from 'zod';
import type { Context } from 'hono';
import { createSuccessData, handleRepositoryError } from '../../utils/api-helpers.ts';
import type { CreateTrainingSessionCommand, TrainingSessionDto } from '../../models/api-types.ts';
import type { AppContext } from '../../context.ts';
import { validateCommandBody } from "../../utils/validation.ts";

const COMMAND_SCHEMA = z.object({
  training_plan_id: z.string().uuid('Invalid training plan ID format'),
  training_plan_day_id: z.string().uuid('Invalid training plan day ID format').nullable().optional(),
});

export async function handleCreateTrainingSession(c: Context<AppContext>) {
  const { command, error: commandError } = await validateCommandBody<typeof COMMAND_SCHEMA, CreateTrainingSessionCommand>(c, COMMAND_SCHEMA);
  if (commandError) return commandError;

  const sessionRepository = c.get('sessionRepository');

  try {
    const session = await sessionRepository.create(command!);

    const successData = createSuccessData<TrainingSessionDto>(session);
    return c.json(successData, 201);
  } catch (e) {
    const fallbackMessage = 'Failed to create training session';
    const mergedErrorHandler = (error: Error) => sessionRepository.handleTrainingPlanNotFoundError(error) || sessionRepository.handleSessionOwnershipError(error);
    return handleRepositoryError(c, e as Error, mergedErrorHandler, handleCreateTrainingSession.name, fallbackMessage);
  }
}
