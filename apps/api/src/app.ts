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
