import { z } from 'zod';
import type { Context } from 'hono';
import type { SessionSetDto, UpdateSessionSetCommand } from '../../models/api-types.ts';
import { createErrorDataWithLogging, createSuccessData, handleRepositoryError } from '../../utils/api-helpers.ts';
import type { AppContext } from '../../context.ts';
import { validateCommandBody, validatePathParams } from "../../utils/validation.ts";

const PATH_SCHEMA = z.object({
  sessionId: z.string().uuid('Invalid sessionId format'),
  setId: z.string().uuid('Invalid setId format'),
});

const COMMAND_SCHEMA = z.object({
  set_index: z.number().int().positive('Set index must be a positive integer').optional(),
  expected_reps: z.number().int().nonnegative('Expected reps must be a non-negative integer').optional(),
  actual_weight: z.number().nonnegative('Actual weight cannot be negative').optional(),
  actual_reps: z.number().int().nonnegative('Actual reps must be a non-negative integer').nullable().optional(),
  status: z.enum(['PENDING', 'COMPLETED', 'FAILED', 'SKIPPED']).optional(),
  completed_at: z.string().datetime('Invalid datetime format for completed_at').nullable().optional()
}).refine(data => !((data.status === 'COMPLETED' || data.status === 'FAILED') && !data.completed_at), {
  message: "completed_at is required if status is COMPLETED or FAILED.",
  path: ["completed_at"],
}).refine(data => (!data.completed_at) || (data.status === 'COMPLETED' || data.status === 'FAILED'), {
  message: "completed_at should only be provided if status is COMPLETED or FAILED.",
  path: ["completed_at"],
});

export async function handleUpdateTrainingSessionSetById(c: Context<AppContext>) {
  const { path, error: pathError } = validatePathParams(c, PATH_SCHEMA);
  if (pathError) return pathError;

  const { command, error: commandError } = await validateCommandBody<typeof COMMAND_SCHEMA, UpdateSessionSetCommand>(c, COMMAND_SCHEMA);
  if (commandError) return commandError;

  const sessionRepository = c.get('sessionRepository');

  try {
    const updatedSet = await sessionRepository.updateSet(path!.sessionId, path!.setId, command!);

    if (!updatedSet) {
      const errorData = createErrorDataWithLogging(404, `Session set with ID ${path!.setId} not found for update.`);
      return c.json(errorData, 404);
    }

    const successData = createSuccessData<SessionSetDto>(updatedSet);
    return c.json(successData, 200);
  } catch (e) {
    const fallbackMessage = 'Failed to update session set';
    return handleRepositoryError(c, e as Error, sessionRepository.handleSessionOwnershipError, handleUpdateTrainingSessionSetById.name, fallbackMessage);
  }
}
