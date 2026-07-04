import { z } from 'zod';
import type { Context } from 'hono';
import { createSuccessData, handleRepositoryError } from '../../utils/api-helpers';
import type { CreateExerciseCommand, ExerciseDto } from '@txg/shared';
import type { AppContext } from '../../context';
import { validateCommandBody } from "../../utils/validation";

const COMMAND_SCHEMA = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().nullable().optional(),
});

export async function handleCreateExercise(c: Context<AppContext>) {
  const { command, error: commandError } = await validateCommandBody<typeof COMMAND_SCHEMA, CreateExerciseCommand>(c, COMMAND_SCHEMA);
  if (commandError) return commandError;

  const exerciseRepository = c.get('exerciseRepository');

  try {
    const newExercise = await exerciseRepository.create(command!);

    const successData = createSuccessData<ExerciseDto>(newExercise);
    return c.json(successData, 201);
  } catch (e) {
    const fallbackMessage = 'Failed to create exercise';
    return handleRepositoryError(c, e as Error, exerciseRepository.handleExerciseError, handleCreateExercise.name, fallbackMessage);
  }
}
