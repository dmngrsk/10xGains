import { z } from 'zod';
import type { Context } from 'hono';
import { createErrorDataWithLogging, createSuccessData } from '../../utils/api-helpers.ts';
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

export async function handleUpsertTrainingPlanExerciseProgression(c: Context<AppContext>) {
  const { path, error: pathError } = validatePathParams(c, PATH_SCHEMA);
  if (pathError) return pathError;

  const { command, error: commandError } = await validateCommandBody<typeof COMMAND_SCHEMA, UpsertTrainingPlanExerciseProgressionCommand>(c, COMMAND_SCHEMA);
  if (commandError) return commandError;

  const supabaseClient = c.get('supabase');

  try {
    const { data: existingProgression, error: existingProgressionError } = await supabaseClient
      .from('training_plan_exercise_progressions')
      .select('*')
      .eq('training_plan_id', path!.planId)
      .eq('exercise_id', path!.exerciseId)
      .maybeSingle();

    if (existingProgressionError) {
      console.error('Error fetching exercise progression for update:', existingProgressionError);
      const errorData = createErrorDataWithLogging(500, 'Failed to fetch exercise progression details for update.', { details: existingProgressionError.message }, undefined, existingProgressionError);
      return c.json(errorData, 500);
    }

    const dataToUpsert: TrainingPlanExerciseProgressionDto = {
      id: existingProgression?.id || crypto.randomUUID(),
      training_plan_id: path!.planId,
      exercise_id: path!.exerciseId,
      weight_increment: command!.weight_increment || existingProgression?.weight_increment || 0,
      failure_count_for_deload: command!.failure_count_for_deload || existingProgression?.failure_count_for_deload || 0,
      deload_percentage: command!.deload_percentage || existingProgression?.deload_percentage || 0,
      deload_strategy: command!.deload_strategy || existingProgression?.deload_strategy || 'PROPORTIONAL',
      reference_set_index: command!.reference_set_index || existingProgression?.reference_set_index || null,
      consecutive_failures: command!.consecutive_failures || existingProgression?.consecutive_failures || 0,
      last_updated: new Date().toISOString(),
    };

    const { data, error } = await supabaseClient
      .from('training_plan_exercise_progressions')
      .upsert(dataToUpsert, { onConflict: 'id' })
      .select()
      .single();

    if (error) {
      console.error('Error updating exercise progression:', error);
      const errorData = createErrorDataWithLogging(500, 'Failed to create or update exercise progression.', { details: error.message }, undefined, error);
      return c.json(errorData, 500);
    }

    const successData = createSuccessData<TrainingPlanExerciseProgressionDto>(data as TrainingPlanExerciseProgressionDto);
    return c.json(successData, 200);
  } catch (e) {
    console.error('Unexpected error in handleUpsertTrainingPlanExerciseProgression:', e);
    const errorData = createErrorDataWithLogging(500, 'An unexpected error occurred.', { details: (e as Error).message }, undefined, e);
    return c.json(errorData, 500);
  }
}
