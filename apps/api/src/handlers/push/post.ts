import { z } from 'zod';
import type { Context } from 'hono';
import type { PushSubscriptionDto, UpsertPushSubscriptionCommand } from '@txg/shared';
import type { AppContext } from '../../context';
import { createSuccessData, handleRepositoryError } from '../../utils/api-helpers';
import { validateCommandBody } from '../../utils/validation';

const COMMAND_SCHEMA = z.object({
  endpoint: z.string().url('Invalid push endpoint URL'),
  keys: z.object({
    p256dh: z.string().min(1, 'Missing p256dh key'),
    auth: z.string().min(1, 'Missing auth key'),
  }),
});

export async function handleUpsertPushSubscription(c: Context<AppContext>) {
  const { command, error: commandError } = await validateCommandBody<typeof COMMAND_SCHEMA, UpsertPushSubscriptionCommand>(c, COMMAND_SCHEMA);
  if (commandError) return commandError;

  const pushSubscriptionRepository = c.get('pushSubscriptionRepository');

  try {
    const subscription = await pushSubscriptionRepository.upsert(command!);

    const successData = createSuccessData<PushSubscriptionDto>(subscription);
    return c.json(successData, 201);
  } catch (e) {
    const fallbackMessage = 'Failed to save push subscription';
    return handleRepositoryError(c, e as Error, pushSubscriptionRepository.handlePushSubscriptionError, handleUpsertPushSubscription.name, fallbackMessage);
  }
}
