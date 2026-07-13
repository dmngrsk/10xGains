import { z } from 'zod';
import type { Context } from 'hono';
import { createErrorDataWithLogging } from './api-helpers';
import type { AppContext } from '../context';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const DEFAULT_OFFSET = 0;
const SORT_PATTERN = /^[a-zA-Z_]+\.(asc|desc)$/;

/**
 * The `limit` query parameter of a paginated list endpoint.
 *
 * A limit of 0 is allowed on purpose: it asks for no rows at all, which clients use to read
 * just the `totalCount` of a collection (the plan editor counts a plan's sessions that way).
 *
 * Coerces with `Number`, so a non-numeric value becomes NaN and is rejected with a 400
 * rather than being silently truncated the way `parseInt('12abc')` would be.
 *
 * @param {number} [defaultLimit] - The page size applied when the parameter is absent.
 * @param {number} [maxLimit] - The largest page size a client may request.
 * @returns A schema producing a page size.
 */
export function optionalLimit(defaultLimit: number = DEFAULT_LIMIT, maxLimit: number = MAX_LIMIT) {
  return z.preprocess(
    (val) => (isAbsent(val) ? undefined : Number(val)),
    z.number().int().nonnegative().max(maxLimit).default(defaultLimit)
  );
}

/**
 * The `offset` query parameter of a paginated list endpoint.
 *
 * @param {number} [defaultOffset] - The offset applied when the parameter is absent.
 * @returns A schema producing a non-negative offset.
 */
export function optionalOffset(defaultOffset: number = DEFAULT_OFFSET) {
  return z.preprocess(
    (val) => (isAbsent(val) ? undefined : Number(val)),
    z.number().int().nonnegative().default(defaultOffset)
  );
}

/**
 * The `sort` query parameter, in `column_name.(asc|desc)` form.
 *
 * @param {string} defaultColumn - The column sorted on when the parameter is absent.
 * @param {'asc' | 'desc'} [defaultDirection] - The direction used with that column.
 * @returns A schema producing a validated sort expression.
 */
export function optionalSort(defaultColumn: string, defaultDirection: 'asc' | 'desc' = 'asc') {
  const fallback = `${defaultColumn}.${defaultDirection}`;

  return z.preprocess(
    (val) => (isAbsent(val) ? fallback : String(val)),
    z.string().regex(SORT_PATTERN, 'Sort parameter must be in format column_name.(asc|desc)').default(fallback)
  );
}

/**
 * An optional query parameter holding an ISO 8601 datetime.
 *
 * Query parameters arrive as strings, so a date-only value such as `2026-04-13` is widened
 * to a full datetime before Zod validates it. An unparseable value is passed through as-is
 * so that Zod rejects it (400 Bad Request); calling `toISOString()` on an Invalid Date would
 * instead throw a RangeError straight out of `safeParse`, surfacing as a 500.
 *
 * @returns A schema accepting an optional ISO datetime string.
 */
export function optionalIsoDate() {
  return z.preprocess((val) => {
    if (val === undefined || val === null || val === '') {
      return undefined;
    }
    const date = new Date(String(val));
    return isNaN(date.getTime()) ? String(val) : date.toISOString();
  }, z.string().datetime().optional());
}

/**
 * An optional query parameter holding a comma-separated list, validated item by item.
 *
 * Blank entries are dropped, so a trailing comma or stray whitespace does not fail the
 * request, and an empty parameter reads as "not provided" rather than an empty list.
 *
 * @param {T} itemSchema - The schema each item must satisfy (e.g. a uuid or an enum).
 * @returns A schema accepting an optional array of items.
 */
export function optionalCsvList<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.preprocess((val) => {
    if (typeof val !== 'string') {
      return undefined;
    }
    const items = val.split(',').map(s => s.trim()).filter(s => s.length > 0);
    return items.length > 0 ? items : undefined;
  }, z.array(itemSchema).optional());
}

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
// Note: U is intentionally unconstrained. The domain command types are derived
// from the generated database Insert/Update types, which are wider than the
// zod schema output (e.g. enum columns typed as plain string), so
// `U extends z.infer<T>` does not hold even though the schema validates the
// same shape at runtime.
export async function validateCommandBody<T extends z.ZodTypeAny, U = z.infer<T>>(
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

function isAbsent(val: unknown): boolean {
  return val === undefined || val === null || val === '';
}
