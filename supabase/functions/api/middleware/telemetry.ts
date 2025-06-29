import type { Context, Next } from 'hono';
import type { AppContext } from '../context.ts';

/**
 * Middleware for telemetry and performance monitoring.
 *
 * This function records the start time of a request and can be extended to
 * include integration with monitoring services like Application Insights.
 *
 * @param {Context<AppContext>} c - The Hono context.
 * @param {Next} next - The next middleware function in the chain.
 */
export const telemetryMiddleware = async (c: Context<AppContext>, next: Next) => {
  const startTime = Date.now();
  c.set('startTime', startTime);

  // TODO: Add telemetry with Application Insights

  await next();
}
