import { Context } from "hono";
import { AppContext } from "../context";
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { isDomainError } from "./errors";

/**
 * Standard API error response
 */
export interface ApiErrorResponse {
  /** Error message */
  error: string;

  /** HTTP status */
  status: ContentfulStatusCode;

  /** Additional error details (optional) */
  details?: Record<string, unknown>;

  /** Error code (optional) */
  code?: string;
}

/**
 * Standard API success response wrapper
 */
export interface ApiSuccessResponse<T> {
  /** Response data */
  data: T;

  /** Total row count (optional) */
  totalCount?: number;

  /** Success message (optional) */
  message?: string;

  /** Server time (ISO 8601) when the response was generated, used by clients to correct clock skew */
  timestamp: string;
}

/**
 * Error details for structured logging
 */
export interface ErrorDetails {
  /** HTTP Status code */
  statusCode: number;
  /** Error message */
  message: string;
  /** Error code (for client identification) */
  code?: string;
  /** Additional error context */
  context?: Record<string, unknown>;
  /** Original error object */
  originalError?: unknown;
  /** Request information */
  request?: {
    method: string;
    path: string;
    headers?: Record<string, string>;
    query?: Record<string, string>;
    body?: unknown;
  };
}

/**
 * Logs a structured error message to the console.
 *
 * This function takes an `ErrorDetails` object and formats it into a JSON string
 * for consistent, parsable error logging.
 *
 * @param {ErrorDetails} error - The error details object to log.
 */
export function logError(error: ErrorDetails): void {
  // An Error is unpacked into its useful parts; anything else is logged whole. Both are folded in
  // with conditional spreads so the entry carries only the keys that actually apply, rather than
  // being pre-declared with four undefined fields and patched afterwards.
  const originalErrorFields = !error.originalError
    ? {}
    : error.originalError instanceof Error
      ? {
          errorName: error.originalError.name,
          errorMessage: error.originalError.message,
          stackTrace: error.originalError.stack,
        }
      : { originalError: error.originalError };

  const logEntry = {
    timestamp: new Date().toISOString(),
    level: 'error',
    statusCode: error.statusCode,
    message: error.message,
    ...(error.code && { code: error.code }),
    ...(error.context && { context: error.context }),
    ...(error.request && { request: error.request }),
    ...originalErrorFields,
  };

  // TODO: Add telemetry
  console.error(JSON.stringify(logEntry));
}

/**
 * Creates a standardized API error response and logs the error details.
 *
 * This function is a wrapper that first logs the error using `logError` and
 * then constructs the client-facing error response.
 *
 * @param {ContentfulStatusCode} status - The HTTP status code for the response.
 * @param {string} message - The error message for the client.
 * @param {Record<string, unknown>} [details] - Optional additional details for the client.
 * @param {string} [code] - Optional error code for client-side handling.
 * @param {unknown} [originalError] - The original error object for server-side logging.
 * @param {ErrorDetails['request']} [requestInfo] - The request information for logging.
 * @returns {ApiErrorResponse} The structured error response object.
 */
export function createErrorDataWithLogging(
  status: ContentfulStatusCode,
  message: string,
  details?: Record<string, unknown>,
  code?: string,
  originalError?: unknown,
  requestInfo?: ErrorDetails['request']
): ApiErrorResponse {
  logError({
    statusCode: status,
    message,
    context: details,
    code,
    originalError,
    request: requestInfo,
  });

  return createErrorData(status, message, details, code);
}

/**
 * Creates a standardized API error response object.
 *
 * @param {ContentfulStatusCode} status - The HTTP status code.
 * @param {string} message - The error message.
 * @param {Record<string, unknown>} [details] - Optional additional error details.
 * @param {string} [code] - Optional error code.
 * @returns {ApiErrorResponse} The structured error response.
 */
export function createErrorData(
  status: ContentfulStatusCode,
  message: string,
  details?: Record<string, unknown>,
  code?: string
): ApiErrorResponse {
  return {
    error: message,
    status,
    ...(details && { details }),
    ...(code && { code }),
  };
}

/**
 * Creates a standardized API success response object.
 *
 * @template T - The type of the data being returned.
 * @param {T} data - The payload to be returned in the response.
 * @param {object} [metadata] - Optional metadata.
 * @param {number} [metadata.totalCount] - The total number of records available.
 * @param {string} [metadata.message] - A success message.
 * @returns {ApiSuccessResponse<T>} The structured success response.
 */
export function createSuccessData<T>(
  data: T,
  metadata?: { totalCount?: number, message?: string }
): ApiSuccessResponse<T> {
  return {
    data,
    ...(metadata?.totalCount !== undefined && { totalCount: metadata.totalCount }),
    ...(metadata?.message !== undefined && { message: metadata.message }),
    timestamp: new Date().toISOString(),
  };
}

/**
 * Creates the response for an unexpected server fault, without disclosing its cause.
 *
 * Raw Supabase and Postgres messages name tables, columns and constraints, so forwarding them to
 * clients hands out a partial schema map and can leak row contents through constraint text. The
 * message is logged in full instead, tagged with a correlation id that is the only detail the
 * client receives - enough to match a user's report to a log line, useless to anyone else.
 *
 * @param {string} message - The generic, client-safe message.
 * @param {unknown} [originalError] - The underlying error, logged but never returned.
 * @param {ErrorDetails['request']} [requestInfo] - The request information for logging.
 * @returns {ApiErrorResponse} The structured error response object.
 */
export function createServerErrorData(
  message: string,
  originalError?: unknown,
  requestInfo?: ErrorDetails['request']
): ApiErrorResponse {
  const correlationId = crypto.randomUUID();

  logError({
    statusCode: 500,
    message,
    code: 'INTERNAL_ERROR',
    context: { correlationId },
    originalError,
    request: requestInfo,
  });

  return {
    error: message,
    status: 500,
    code: 'INTERNAL_ERROR',
    details: { correlationId },
  };
}

/**
 * Maps a thrown value to an API error response when it carries its own HTTP semantics.
 *
 * This is the single place domain errors become responses. Anything that is not a `DomainError`
 * is an unexpected fault and returns null so the caller can fall back to a 500.
 *
 * @param {unknown} error - The caught error.
 * @returns {ApiErrorResponse | null} The mapped response, or null if the error is not a domain error.
 */
export function mapDomainError(error: unknown): ApiErrorResponse | null {
  if (!isDomainError(error)) {
    return null;
  }

  // 5xx domain errors indicate inconsistent stored data, which is worth a log line; 4xx ones are
  // ordinary client outcomes and would only add noise.
  if (error.status >= 500) {
    return createErrorDataWithLogging(error.status, error.message, { type: error.type }, error.code, error);
  }

  return createErrorData(error.status, error.message, { type: error.type }, error.code);
}

/**
 * Generic handler for repository errors with fallback to general server error.
 *
 * Domain errors carry their own status and code, so no per-repository matcher is needed; anything
 * else is genuinely unexpected and becomes a 500.
 *
 * @param {Context<AppContext>} c - Hono context
 * @param {unknown} error - The caught error
 * @param {string} operationName - Name of the operation for logging purposes
 * @param {string} fallbackMessage - Message to use for the generic 500 error
 * @returns {Response} A JSON response containing the error details.
 */
export function handleRepositoryError(
  c: Context<AppContext>,
  error: unknown,
  operationName: string,
  fallbackMessage: string
) {
  const domainError = mapDomainError(error);
  if (domainError) {
    return c.json(domainError, domainError.status);
  }

  console.error(`Unexpected error in ${operationName}:`, error);
  const errorData = createServerErrorData(fallbackMessage, error);
  return c.json(errorData, 500);
}
