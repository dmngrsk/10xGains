import { sendNotification } from 'web-push';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, PushSubscriptionDto } from '@txg/shared';
import type { SessionAlertMessage } from './session-alert.types';
import { buildSessionAlertNotification } from './session-alert-notification';

export interface SessionAlertContext {
  sessionStatus: string | null;
  hasNewerActivity: boolean;
}

/**
 * Decides whether a scheduled alert is still worth delivering: only when the
 * session is still in progress and the user has not logged anything since it
 * was scheduled (which would make the alert stale).
 */
export function shouldSendSessionAlert(context: SessionAlertContext): boolean {
  if (context.sessionStatus !== 'IN_PROGRESS') {
    return false;
  }
  if (context.hasNewerActivity) {
    return false;
  }
  return true;
}

/**
 * Validates a queued session alert against live state and, if still relevant,
 * delivers it to all of the user's push subscriptions. Stale endpoints
 * (404/410) are pruned.
 */
export async function processSessionAlert(
  supabase: SupabaseClient<Database>,
  message: SessionAlertMessage
): Promise<void> {
  const context = await loadAlertContext(supabase, message);
  if (!shouldSendSessionAlert(context)) {
    return;
  }

  const { data: subscriptions } = await supabase
    .from('push_subscriptions')
    .select('*')
    .eq('user_id', message.userId);

  if (!subscriptions || subscriptions.length === 0) {
    return;
  }

  const payload = JSON.stringify({ notification: buildSessionAlertNotification(message) });
  await Promise.all(subscriptions.map(subscription => sendToSubscription(supabase, subscription, payload)));
}

async function loadAlertContext(
  supabase: SupabaseClient<Database>,
  message: SessionAlertMessage
): Promise<SessionAlertContext> {
  const { data: session } = await supabase
    .from('sessions')
    .select('status')
    .eq('id', message.sessionId)
    .eq('user_id', message.userId)
    .maybeSingle();

  if (!session) {
    return { sessionStatus: null, hasNewerActivity: false };
  }

  const { data: newerSets } = await supabase
    .from('session_sets')
    .select('id')
    .eq('session_id', message.sessionId)
    .gt('completed_at', message.scheduledFromIso)
    .limit(1);

  return {
    sessionStatus: session.status,
    hasNewerActivity: !!newerSets && newerSets.length > 0,
  };
}

async function sendToSubscription(
  supabase: SupabaseClient<Database>,
  subscription: PushSubscriptionDto,
  payload: string
): Promise<void> {
  try {
    await sendNotification(
      { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
      payload
    );
  } catch (e) {
    const statusCode = (e as { statusCode?: number }).statusCode;
    if (statusCode === 404 || statusCode === 410) {
      await supabase.from('push_subscriptions').delete().eq('id', subscription.id);
    }
  }
}
