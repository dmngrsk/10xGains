import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { telemetryMiddleware } from "./middleware/telemetry";
import { supabaseMiddleware } from "./middleware/supabase";
import { repositoriesMiddleware } from "./middleware/repositories";
import { routes } from './middleware/routes';
import { resolveAllowedOrigins } from './utils/cors';
import type { AppContext } from './context';

const corsOptions = {
  origin: resolveAllowedOrigins(),
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  // Only what the web app actually sends. `apikey` and `x-client-info` are supabase-js headers,
  // and the browser talks to Supabase directly rather than through this API, so allowing them here
  // only widened the preflight response for no caller.
  allowHeaders: ['content-type', 'authorization'],
  credentials: true,
};

const app = new Hono<AppContext>();

app
  .use('*', cors(corsOptions))
  .use('*', supabaseMiddleware)
  .use('*', telemetryMiddleware)
  .use('*', repositoriesMiddleware)
  .route('/api', routes);

export default app;
