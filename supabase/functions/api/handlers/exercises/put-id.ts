import { z } from 'zod';
import type { Context } from 'hono';
import { createErrorDataWithLogging, createSuccessData, handleRepositoryError } from '../../utils/api-helpers.ts';
import type { ExerciseDto, UpdateExerciseCommand } from '../../models/api.types.ts';
import type { AppContext } from '../../context.ts';
import { validateCommandBody, validatePathParams } from "../../utils/validation.ts";

const PATH_SCHEMA = z.object({
  exerciseId: z.string().uuid('Invalid exerciseId format'),
});

const COMMAND_SCHEMA = z.object({
  name: z.string().min(1, 'Name must not be empty').optional(),
  description: z.string().nullable().optional(),
}).refine(data => Object.keys(data).length > 0, {
  message: "Request body must contain at least one field to update."
});

export async function handlePutExerciseById(c: Context<AppContext>) {
  const { path, error: pathError } = validatePathParams(c, PATH_SCHEMA);
  if (pathError) return pathError;

  const { command, error: commandError } = await validateCommandBody<typeof COMMAND_SCHEMA, UpdateExerciseCommand>(c, COMMAND_SCHEMA);
  if (commandError) return commandError;

  const exerciseRepository = c.get('exerciseRepository');

  try {
    const updatedExercise = await exerciseRepository.update(path!.exerciseId, command!);

    if (!updatedExercise) {
      const errorData = createErrorDataWithLogging(404, 'Exercise not found for update');
      return c.json(errorData, 404);
    }

    const successData = createSuccessData<ExerciseDto>(updatedExercise);
    return c.json(successData, 200);
  } catch (e) {
    const fallbackMessage = 'Failed to update exercise';
    return handleRepositoryError(c, e as Error, exerciseRepository.handleExerciseError, handlePutExerciseById.name, fallbackMessage);
  }
}
