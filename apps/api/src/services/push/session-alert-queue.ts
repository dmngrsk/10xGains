import { QueueClient } from '@azure/storage-queue';
import type { SessionAlertMessage } from './session-alert.types';

const QUEUE_NAME = 'session-alerts';

// Azure Functions' queue trigger decodes messages as base64 by default, so the
// queue client base64-encodes the JSON payload to match.
let queueClient: QueueClient | undefined;

function getQueueClient(): QueueClient {
  if (!queueClient) {
    queueClient = new QueueClient(process.env['AzureWebJobsStorage'] ?? '', QUEUE_NAME);
  }
  return queueClient;
}

/**
 * Schedules a session alert for delivery after `delaySeconds` using the queue's
 * visibility timeout. The queue-trigger function picks it up when it becomes
 * visible and re-validates it before sending.
 */
export async function enqueueSessionAlert(message: SessionAlertMessage, delaySeconds: number): Promise<void> {
  const client = getQueueClient();
  await client.createIfNotExists();

  const encoded = Buffer.from(JSON.stringify(message)).toString('base64');
  await client.sendMessage(encoded, { visibilityTimeout: delaySeconds });
}

/** Resets the memoized client (used by tests). */
export function resetSessionAlertQueueClient(): void {
  queueClient = undefined;
}
