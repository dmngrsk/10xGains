import { z } from 'zod';
import type { Context } from 'hono';
import { createErrorDataWithLogging } from './api-helpers.ts';
import type { AppContext } from '../context.ts';

/**
 * Validates the path parameters of a request against a Zod schema.
 *
 * It uses a Zod schema to parse and validate the path parameters from the request context.
 * If validation fails, it returns a `400 Bad Request` response with detailed errors.
 *
 * @template T - The Zod schema type.
 * @template U - The inferred type from the schema.
 * @param {Context<AppContext>} c - The Hono context of the request.
 * @param {T} schema - The Zod schema to validate against.
 * @returns {{ path?: U, error?: Response }} An object containing either the validated path parameters or an error Response.
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
 * Validates the query parameters of a request against a Zod schema.
 *
 * It parses the query parameters from the request context and validates them.
 * If validation fails, it returns a `400 Bad Request` response.
 *
 * @template T - The Zod schema type.
 * @template U - The inferred type from the schema.
 * @param {Context<AppContext>} c - The Hono context of the request.
 * @param {T} schema - The Zod schema for validation.
 * @returns {{ query?: U, error?: Response }} An object containing either the validated query parameters or an error Response.
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
 * Asynchronously validates the JSON body of a request against a Zod schema.
 *
 * It attempts to parse the request body as JSON and then validates it.
 * It handles JSON parsing errors and validation errors, returning a `400 Bad Request`
 * response in case of failure.
 *
 * @template T - The Zod schema type.
 * @template U - The inferred type from the schema.
 * @param {Context<AppContext>} c - The Hono context of the request.
 * @param {T} schema - The Zod schema for validation.
 * @returns {Promise<{ command?: U, error?: Response }>} A promise that resolves to an object containing either the validated body (command) or an error Response.
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
