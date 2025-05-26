import { createClient, type SupabaseClient } from 'supabase';
import type { Database } from '../models/database-types.ts';

// CORS headers for all Supabase Edge Functions
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
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
 * Generic user interface for Supabase Auth
 */
export interface SupabaseUser {
  id: string;
  email?: string;
  // role?: string; // Add other relevant user fields if necessary
  [key: string]: unknown;
}

// UUID validation regex
const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
  status: number,
  data: T,
  metadata?: { totalCount?: number, message?: string }
): Response {
  // For 204 No Content responses, don't include a body
  if (status === 204) {
    return new Response(null, {
      status,
      headers: corsHeaders
    });
  }

  // For all other success responses, include the JSON body
  const response: ApiSuccessResponse<T> = {
    data,
    totalCount: metadata?.totalCount ?? undefined,
    message: metadata?.message ?? undefined,
  };

  return new Response(JSON.stringify(response), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * Validates that a resource exists and belongs to the authenticated user
 */
export async function validateResourceOwnership(
  supabaseClient: SupabaseClient<Database>,
  table: string,
  resourceId: string,
  userField: string,
  userId: string,
  requestInfo: ReturnType<typeof createRequestInfo>
): Promise<Response | null> {
  // Validate UUID format
  if (!uuidRegex.test(resourceId)) {
    return createErrorResponse(
      400,
      `Invalid ID format for ${table} resource: ${resourceId}`,
      undefined,
      'INVALID_UUID',
      undefined,
      requestInfo
    );
  }

  // Check if resource exists and belongs to the user
  const { data, error } = await supabaseClient
    .from(table)
    .select('id')
    .eq('id', resourceId)
    .eq(userField, userId)
    .single();

  if (error || !data) {
    return createErrorResponse(
      404,
      `Resource not found or access denied: ${table} with ID ${resourceId}`,
      undefined,
      'RESOURCE_NOT_FOUND_OR_FORBIDDEN',
      error,
      requestInfo
    );
  }

  // Return null if validation is successful
  return null;
}

/**
 * Create a Supabase client
 */
export const createSupabaseClient = (req: Request): SupabaseClient<Database> => {
  return createClient<Database>(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    {
      global: {
        headers: { Authorization: req.headers.get('Authorization')! },
      },
    }
  );
};

/**
 * Takes an object and returns a new object containing only the properties
 * from the input object that are not undefined.
 * Useful for preparing data for partial updates to avoid unintentionally
 * setting fields to null in the database.
 * @param data The input object.
 * @returns A new object with undefined properties removed.
 */
export function stripUndefinedValues<T extends Record<string, unknown>>(
  data: T
): Partial<T> {
  const result: Partial<T> = {};
  for (const key in data) {
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      const K = key as keyof T;
      if (data[K] !== undefined) {
        result[K] = data[K];
      }
    }
  }
  return result;
}

/**
 * Checks if the request body is empty or effectively empty (e.g., contains only '{}').
 * This function first checks the 'content-length' header. If it indicates an empty body,
 * it returns true. Otherwise, it attempts to clone the request, read its body as text,
 * and checks if the trimmed text is an empty string or an empty JSON object string ('{}').
 *
 * Note: Cloning and reading the request body consumes it. If the original request body
 * needs to be read later, ensure this function is called on a clone or that the body
 * is re-fetched/re-constructed if necessary for subsequent operations.
 * However, for typical use cases like validating an empty body for POST/PUT requests
 * that shouldn't have one, this consumption is usually not an issue.
 *
 * @param req The Request object to check.
 * @returns A Promise that resolves to true if the body is empty, false otherwise.
 */
export async function isRequestBodyEmpty(req: Request): Promise<boolean> {
  const contentLength = req.headers.get('content-length');
  if (!contentLength || parseInt(contentLength, 10) === 0) {
    return true;
  }
  try {
    // Clone the request to read its body without consuming the original request's body stream
    // if it were to be read again (though for this function's purpose, it's usually a final check).
    const clonedReq = req.clone();
    const bodyText = await clonedReq.text();
    const trimmedBody = bodyText.trim();
    // Check for empty string or an empty JSON object string
    return trimmedBody === '' || trimmedBody === '{}';
  } catch (error) {
    // If reading the body fails (e.g., network error, already consumed elsewhere unexpectedly),
    // log a warning. It's safer to assume the body is not empty in case of an error reading it,
    // especially if content-length indicated there was content.
    console.warn('Could not definitively read request body to check for emptiness:', error);
    return false;
  }
}
