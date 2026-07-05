import { app } from '@azure/functions';
import { azureHonoHandler } from '@marplex/hono-azurefunc-adapter';
import honoApp from './app';
// Side-effect import: registers the `sendPush` storage-queue trigger.
import './functions/send-push';

// Single catch-all HTTP function: Azure Functions is only the transport,
// all routing/middleware lives in the Hono app. Combined with host.json's
// default routePrefix ("api"), incoming URLs keep the /api/... shape the
// Hono app already mounts at.
app.http('api', {
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
  authLevel: 'anonymous',
  route: '{*path}',
  handler: azureHonoHandler(honoApp.fetch),
});
