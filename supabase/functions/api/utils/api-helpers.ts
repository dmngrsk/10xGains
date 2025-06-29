import { Context } from "hono";
import { AppContext } from "../context.ts";
import type { StatusCode } from 'hono/utils/http-status';

/**
 * Standard API error response
 */
export interface ApiErrorResponse {
  /** Error message */
  error: string;

  /** HTTP status */
  status: StatusCode;

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
  const logEntry = {
    timestamp: new Date().toISOString(),
    level: 'error',
    statusCode: error.statusCode,
    message: error.message,
    ...(error.code && { code: error.code }),
    ...(error.context && { context: error.context }),
    ...(error.request && { request: error.request }),
    errorName: undefined as string | undefined,
    errorMessage: undefined as string | undefined,
    stackTrace: undefined as string | undefined,
    originalError: undefined as unknown | undefined,
  };

  if (error.originalError) {
    // For original Error objects, extract useful properties
    if (error.originalError instanceof Error) {
      logEntry.errorName = error.originalError.name;
      logEntry.errorMessage = error.originalError.message;
      logEntry.stackTrace = error.originalError.stack;
    } else {
      // For non-Error objects, include the entire object
      logEntry.originalError = error.originalError;
    }
  }

  // TODO: Add telemetry
  console.error(JSON.stringify(logEntry));
}

/**
 * Creates a standardized API error response and logs the error details.
 *
 * This function is a wrapper that first logs the error using `logError` and
 * then constructs the client-facing error response.
 *
 * @param {StatusCode} status - The HTTP status code for the response.
 * @param {string} message - The error message for the client.
 * @param {Record<string, unknown>} [details] - Optional additional details for the client.
 * @param {string} [code] - Optional error code for client-side handling.
 * @param {unknown} [originalError] - The original error object for server-side logging.
 * @param {ErrorDetails['request']} [requestInfo] - The request information for logging.
 * @returns {ApiErrorResponse} The structured error response object.
 */
export function createErrorDataWithLogging(
  status: StatusCode,
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
 * @param {StatusCode} status - The HTTP status code.
 * @param {string} message - The error message.
 * @param {Record<string, unknown>} [details] - Optional additional error details.
 * @param {string} [code] - Optional error code.
 * @returns {ApiErrorResponse} The structured error response.
 */
export function createErrorData(
  status: StatusCode,
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
    totalCount: metadata?.totalCount ?? undefined,
    message: metadata?.message ?? undefined,
  };
}

/**
 * Generic handler for repository errors with fallback to general server error.
 *
 * @param {Context<AppContext>} c - Hono context
 * @param {Error} error - The caught error
 * @param {(error: Error) => T | null} repositoryErrorHandler - Function to handle repository-specific errors (e.g., planRepository.handlePlanError)
 * @param {string} operationName - Name of the operation for logging purposes
 * @param {string} fallbackMessage - Message to use for the generic 500 error
 * @returns {Response} A JSON response containing the error details.
 */
export function handleRepositoryError<T extends { status: StatusCode }>(
  c: Context<AppContext>,
  error: Error,
  repositoryErrorHandler: (error: Error) => T | null,
  operationName: string,
  fallbackMessage: string
) {
  const repositoryError = repositoryErrorHandler(error);
  if (repositoryError) {
    return c.json(repositoryError, repositoryError.status);
  }

  console.error(`Unexpected error in ${operationName}:`, error);
  const errorData = createErrorDataWithLogging(
    500,
    fallbackMessage,
    { details: (error as Error).message },
    undefined,
    error
  );
  return c.json(errorData, 500);
}
