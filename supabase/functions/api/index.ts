import { Hono } from 'hono';
import { cors } from 'hono/middleware';
import { telemetryMiddleware } from "./middleware/telemetry.ts";
import { supabaseMiddleware } from "./middleware/supabase.ts";
import { repositoriesMiddleware } from "./middleware/repositories.ts";
import { routes } from './middleware/routes.ts';
import type { AppContext } from './context.ts';

const corsOptions = {
  origin: [Deno.env.get('APP_URL') ?? 'http://localhost:4200'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowHeaders: ['content-type', 'authorization', 'apikey', 'x-client-info'],
  credentials: true,
};

const app = new Hono<AppContext>();

app
  .use('*', cors(corsOptions))
  .use('*', supabaseMiddleware)
  .use('*', telemetryMiddleware)
  .use('*', repositoriesMiddleware)
  .route('/api', routes);

Deno.serve(app.fetch);
