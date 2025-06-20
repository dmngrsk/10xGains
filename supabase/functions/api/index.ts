import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { telemetryMiddleware } from "./middleware/telemetry.ts";
import { supabaseMiddleware } from "./middleware/supabase.ts";
import { routes } from './middleware/routes.ts';
import type { AppContext } from './context.ts';

const corsOptions = {
  origin: ['http://localhost:4200'], // TODO: Add from env
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowHeaders: ['content-type', 'authorization', 'apikey', 'x-client-info'],
  credentials: true,
};

const app = new Hono<AppContext>();

app
  .use('*', cors(corsOptions))
  .use('*', supabaseMiddleware)
  .use('*', telemetryMiddleware)
  .route('/api', routes);

Deno.serve(app.fetch);
