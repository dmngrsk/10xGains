import { z } from 'zod';
import type { Context } from 'hono';
import { createSuccessData, handleRepositoryError } from '../../utils/api-helpers.ts';
import type { CreateSessionSetCommand, SessionSetDto } from '../../models/api.types.ts';
import type { AppContext } from '../../context.ts';
import { validateCommandBody, validatePathParams } from "../../utils/validation.ts";

const PATH_SCHEMA = z.object({
  sessionId: z.string().uuid('Invalid sessionId format'),
});

const COMMAND_SCHEMA = z.object({
  plan_exercise_id: z.string().uuid('Invalid plan exercise ID format'),
  set_index: z.number().int().positive('Set index must be a positive integer').optional(),
  expected_reps: z.number().int().nonnegative('Expected reps must be a non-negative integer'),
  actual_reps: z.number().int().nonnegative('Actual reps must be a non-negative integer').nullable().optional(),
  actual_weight: z.number().nonnegative('Actual weight cannot be negative'),
  status: z.enum(['PENDING', 'COMPLETED', 'FAILED', 'SKIPPED']).default('PENDING').optional(),
  completed_at: z.string().datetime('Invalid datetime format for completed_at').nullable().optional(),
}).refine(data => !((data.status === 'COMPLETED' || data.status === 'FAILED') && !data.completed_at), {
   message: "completed_at is required if status is COMPLETED or FAILED.",
   path: ["completed_at"],
}).refine(data => (!data.completed_at) || (data.status === 'COMPLETED' || data.status === 'FAILED'), {
  message: "completed_at should only be provided if status is COMPLETED or FAILED.",
  path: ["completed_at"],
});

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
