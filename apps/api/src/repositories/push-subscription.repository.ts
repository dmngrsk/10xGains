import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, PushSubscriptionDto, UpsertPushSubscriptionCommand } from '@txg/shared';
import { ApiErrorResponse } from '../utils/api-helpers';

export class PushSubscriptionRepository {
  constructor(
    private supabase: SupabaseClient<Database>,
    private getUserId: () => string
  ) {}

  /**
   * Registers (or refreshes) a Web Push subscription for the current user.
   * Keyed by the browser `endpoint`, so re-subscribing the same device updates in place.
   *
   * @param {UpsertPushSubscriptionCommand} command - The browser push subscription payload.
   * @returns {Promise<PushSubscriptionDto>} The stored subscription.
   */
  async upsert(command: UpsertPushSubscriptionCommand): Promise<PushSubscriptionDto> {
    const { data, error } = await this.supabase
      .from('push_subscriptions')
      .upsert(
        {
          user_id: this.getUserId(),
          endpoint: command.endpoint,
          p256dh: command.keys.p256dh,
          auth: command.keys.auth,
        },
        { onConflict: 'endpoint' }
      )
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data as PushSubscriptionDto;
  }

  /**
   * Removes a subscription for the current user by its endpoint (e.g. on unsubscribe).
   *
   * @param {string} endpoint - The push endpoint to remove.
   */
  async deleteByEndpoint(endpoint: string): Promise<void> {
    const { error } = await this.supabase
      .from('push_subscriptions')
      .delete()
      .eq('user_id', this.getUserId())
      .eq('endpoint', endpoint);

    if (error) {
      throw error;
    }
  }

  /**
   * Placeholder for subscription-specific error mapping; there are no bespoke
   * cases yet, so callers fall through to the generic server error.
   */
  handlePushSubscriptionError(): ApiErrorResponse | null {
    return null;
  }
}
