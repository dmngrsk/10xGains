import { app, InvocationContext } from '@azure/functions';
import { setVapidDetails } from 'web-push';
import { createAdminSupabaseClient } from '../utils/supabase-admin';
import { processSessionAlert } from '../services/push/push-sender';
import { parseSessionAlertMessage } from '../services/push/session-alert-message';

let vapidConfigured = false;

function ensureVapidConfigured(): void {
  if (vapidConfigured) {
    return;
  }
  setVapidDetails(
    process.env['VAPID_SUBJECT'] ?? '',
    process.env['VAPID_PUBLIC_KEY'] ?? '',
    process.env['VAPID_PRIVATE_KEY'] ?? ''
  );
  vapidConfigured = true;
}

export async function sendPush(queueItem: unknown, context: InvocationContext): Promise<void> {
  const message = parseSessionAlertMessage(queueItem);
  if (!message) {
    context.warn('Received an invalid session alert message; skipping.');
    return;
  }

  ensureVapidConfigured();
  const supabase = createAdminSupabaseClient();

  try {
    await processSessionAlert(supabase, message);
  } catch (e) {
    context.error('Failed to process session alert', e);
  }
}

app.storageQueue('sendPush', {
  queueName: 'session-alerts',
  connection: 'AzureWebJobsStorage',
  handler: sendPush,
});
