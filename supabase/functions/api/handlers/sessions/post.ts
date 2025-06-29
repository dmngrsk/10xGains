import { z } from 'zod';
import type { Context } from 'hono';
import { createSuccessData, handleRepositoryError } from '../../utils/api-helpers.ts';
import type { CreateSessionCommand, SessionDto } from '../../models/api.types.ts';
import type { AppContext } from '../../context.ts';
import { validateCommandBody } from "../../utils/validation.ts";

const COMMAND_SCHEMA = z.object({
  plan_id: z.string().uuid('Invalid plan ID format'),
  plan_day_id: z.string().uuid('Invalid plan day ID format').nullable().optional(),
});

export async function handleCreateSession(c: Context<AppContext>) {
  const { command, error: commandError } = await validateCommandBody<typeof COMMAND_SCHEMA, CreateSessionCommand>(c, COMMAND_SCHEMA);
  if (commandError) return commandError;

  const sessionRepository = c.get('sessionRepository');

  try {
    const session = await sessionRepository.create(command!);

    const successData = createSuccessData<SessionDto>(session);
    return c.json(successData, 201);
  } catch (e) {
    const fallbackMessage = 'Failed to create training session';
    const mergedErrorHandler = (error: Error) => sessionRepository.handlePlanNotFoundError(error) || sessionRepository.handleSessionOwnershipError(error);
    return handleRepositoryError(c, e as Error, mergedErrorHandler, handleCreateSession.name, fallbackMessage);
  }
}
