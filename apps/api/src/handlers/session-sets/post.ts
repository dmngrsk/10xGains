import { z } from 'zod';
import type { Context } from 'hono';
import { createSuccessData, handleRepositoryError } from '../../utils/api-helpers';
import { SESSION_SET_STATUSES, type CreateSessionSetCommand, type SessionSetDto } from '@txg/shared';
import type { AppContext } from '../../context';
import { validateCommandBody, validatePathParams, withCompletedAtConsistency } from "../../utils/validation";

const PATH_SCHEMA = z.object({
  sessionId: z.string().uuid('Invalid sessionId format'),
});

const COMMAND_SCHEMA = withCompletedAtConsistency(z.object({
  plan_exercise_id: z.string().uuid('Invalid plan exercise ID format'),
  set_index: z.number().int().positive('Set index must be a positive integer').optional(),
  expected_reps: z.number().int().nonnegative('Expected reps must be a non-negative integer'),
  actual_reps: z.number().int().nonnegative('Actual reps must be a non-negative integer').nullable().optional(),
  actual_weight: z.number().nonnegative('Actual weight cannot be negative'),
  status: z.enum(SESSION_SET_STATUSES).default('PENDING').optional(),
  completed_at: z.string().datetime('Invalid datetime format for completed_at').nullable().optional(),
}));

export async function handleCreateSessionSet(c: Context<AppContext>) {
  const { path, error: pathError } = validatePathParams(c, PATH_SCHEMA);
  if (pathError) return pathError;

  const { command, error: commandError } = await validateCommandBody<typeof COMMAND_SCHEMA, CreateSessionSetCommand>(c, COMMAND_SCHEMA);
  if (commandError) return commandError;

  const sessionRepository = c.get('sessionRepository');

  try {
    const sessionSet = await sessionRepository.createSet(path!.sessionId, command!);

    const successData = createSuccessData<SessionSetDto>(sessionSet);
    return c.json(successData, 201);
  } catch (e) {
    const fallbackMessage = 'Failed to create session set';
    return handleRepositoryError(c, e as Error, sessionRepository.handleSessionOwnershipError, handleCreateSessionSet.name, fallbackMessage);
  }
}
