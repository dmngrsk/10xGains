import { z } from 'zod';
import type { Context } from 'hono';
import type { AppContext } from '../../context';
import { handleRepositoryError } from '../../utils/api-helpers';
import { validateQueryParams } from '../../utils/validation';

const QUERY_SCHEMA = z.object({
  endpoint: z.string().url('Invalid push endpoint URL'),
});

export async function handleDeletePushSubscription(c: Context<AppContext>) {
  const { query, error: queryError } = validateQueryParams(c, QUERY_SCHEMA);
  if (queryError) return queryError;

  const pushSubscriptionRepository = c.get('pushSubscriptionRepository');

  try {
    await pushSubscriptionRepository.deleteByEndpoint(query!.endpoint);
    return c.body(null, 204);
  } catch (e) {
    const fallbackMessage = 'Failed to delete push subscription';
    return handleRepositoryError(c, e as Error, pushSubscriptionRepository.handlePushSubscriptionError, handleDeletePushSubscription.name, fallbackMessage);
  }
}
