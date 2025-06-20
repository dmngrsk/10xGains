import type { Context, Next } from 'hono';
import type { AppContext } from '../context.ts';

export const telemetryMiddleware = async (c: Context<AppContext>, next: Next) => {
  const startTime = Date.now();
  c.set('startTime', startTime);

  // TODO: Add Application Insights

  await next();
}
