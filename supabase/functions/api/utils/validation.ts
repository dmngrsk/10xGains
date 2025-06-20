import { z } from 'zod';
import type { Context } from 'hono';
import { createErrorDataWithLogging } from './api-helpers.ts';
import type { AppContext } from '../context.ts';

/**
 * Helper function to validate path parameters
 */
export function validatePathParams<T extends z.ZodTypeAny, U extends z.infer<T>>(
  c: Context<AppContext>,
  schema: T
): { path?: U, error?: Response } {
  const pathParams = c.req.param();
  const validation = schema.safeParse(pathParams);

  if (!validation.success) {
    const errorData = createErrorDataWithLogging(
      400,
      'Invalid path parameters',
      {
        errors: validation.error.flatten().fieldErrors,
        received: pathParams
      },
      'INVALID_PATH_PARAMS'
    );
    return { error: c.json(errorData, 400) };
  }

  return { path: validation.data as U };
}

/**
 * Helper function to validate query parameters
 */
export function validateQueryParams<T extends z.ZodTypeAny, U extends z.infer<T>>(
  c: Context<AppContext>,
  schema: T
): { query?: U, error?: Response } {
  const rawQueryParams = c.req.queries() || {};
  const queryParams = Object.fromEntries(
    Object.entries(rawQueryParams).map(([key, values]) => [key, values[0]])
  );
  const validation = schema.safeParse(queryParams);

  if (!validation.success) {
    const errorData = createErrorDataWithLogging(
      400,
      'Invalid query parameters',
      {
        errors: validation.error.flatten().fieldErrors,
        received: queryParams
      },
      'INVALID_QUERY_PARAMS'
    );
    return { error: c.json(errorData, 400) };
  }

  return { query: validation.data as U };
}

/**
 * Helper function to validate request body
 */
export async function validateCommandBody<T extends z.ZodTypeAny, U extends z.infer<T>>(
  c: Context<AppContext>,
  schema: T
): Promise<{ command?: U, error?: Response }> {
  let rawBody: unknown;

  try {
    rawBody = await c.req.json();
  } catch (e) {
    const errorData = createErrorDataWithLogging(
      400,
      'Invalid JSON body',
      { details: (e as Error).message },
      'INVALID_JSON',
      e
    );
    return { error: c.json(errorData, 400) };
  }

  const validation = schema.safeParse(rawBody);

  if (!validation.success) {
    const errorData = createErrorDataWithLogging(
      400,
      'Invalid request body',
      {
        errors: validation.error.flatten().fieldErrors,
        received: rawBody
      },
      'INVALID_COMMAND_BODY'
    );
    return { error: c.json(errorData, 400) };
  }

  return { command: validation.data as U };
}
