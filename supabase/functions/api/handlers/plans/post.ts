import { z } from 'zod';
import type { Context } from 'hono';
import { createSuccessData, handleRepositoryError } from '../../utils/api-helpers.ts';
import type { CreatePlanCommand, PlanDto } from '../../models/api.types.ts';
import type { AppContext } from '../../context.ts';
import { validateCommandBody } from "../../utils/validation.ts";

const COMMAND_SCHEMA = z.object({
  name: z.string().min(1, 'Name must not be empty'),
  description: z.string().nullable().optional(),
});

export async function handleCreatePlan(c: Context<AppContext>) {
  const { command, error: commandError } = await validateCommandBody<typeof COMMAND_SCHEMA, CreatePlanCommand>(c, COMMAND_SCHEMA);
  if (commandError) return commandError;

  const planRepository = c.get('planRepository');
  const user = c.get('user');

  try {
    const newPlan = await planRepository.create(user!.id, command!);

    const successData = createSuccessData<PlanDto>(newPlan);
    return c.json(successData, 201);
  } catch (e) {
    const fallbackMessage = 'Failed to create plan';
    return handleRepositoryError(c, e as Error, planRepository.handlePlanOwnershipError, handleCreatePlan.name, fallbackMessage);
  }
}
