/**
 * API Helper Types and Utilities
 *
 * This file contains helper types and utility functions for API responses
 * that aren't defined in the main api.types.ts file.
 */

// CORS headers for all Supabase Edge Functions
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

/**
 * Standard API error response
 */
export interface ApiErrorResponse {
  /** Error message */
  error: string;

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
 * Log a structured error message
 */
export function logError(error: ErrorDetails): void {
  // Format the error for console output
  const logEntry = {
    timestamp: new Date().toISOString(),
    level: 'error',
    statusCode: error.statusCode,
    message: error.message,
    ...(error.code && { code: error.code }),
    ...(error.context && { context: error.context }),
    ...(error.request && { request: error.request }),
  };

  if (error.originalError) {
    // For original Error objects, extract useful properties
    if (error.originalError instanceof Error) {
      logEntry['errorName'] = error.originalError.name;
      logEntry['errorMessage'] = error.originalError.message;
      logEntry['stackTrace'] = error.originalError.stack;
    } else {
      // For non-Error objects, include the entire object
      logEntry['originalError'] = error.originalError;
    }
  }

  // Log as JSON for better parsing in log management systems
  console.error(JSON.stringify(logEntry));
}

/**
 * Create a request object for error logging
 */
export function createRequestInfo(req: Request): ErrorDetails['request'] {
  try {
    const url = new URL(req.url);
    return {
      method: req.method,
      path: url.pathname,
      headers: Object.fromEntries(req.headers),
      query: Object.fromEntries(url.searchParams),
    };
  } catch {
    // Fallback if URL parsing fails
    return {
      method: req.method,
      path: 'unknown',
    };
  }
}

/**
 * Helper function to create error responses
 */
export function createErrorResponse(
  status: number,
  message: string,
  details?: Record<string, unknown>,
  code?: string,
  originalError?: unknown,
  requestInfo?: ErrorDetails['request']
): Response {
  // Log the error with structured format
  logError({
    statusCode: status,
    message,
    context: details,
    code,
    originalError,
    request: requestInfo,
  });

  const errorResponse: ApiErrorResponse = {
    error: message,
    ...(details && { details }),
    ...(code && { code }),
  };

  return new Response(JSON.stringify(errorResponse), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * Create a success response
 */
export function createSuccessResponse<T>(
  data: T,
  message?: string,
  status = 200
): Response {
  const response: ApiSuccessResponse<T> = {
    data,
    ...(message && { message }),
  };

  return new Response(JSON.stringify(response), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
