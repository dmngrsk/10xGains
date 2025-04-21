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
 * Options for API handler
 */
export interface ApiHandlerOptions {
  /** Allowed HTTP methods for this endpoint */
  allowedMethods: string[];
  /**
   * Array of path segments defining the resource path pattern
   * - Static segments are exact matches (e.g., 'profiles')
   * - Dynamic segments are enclosed in curly braces (e.g., '{id}')
   * Example: ['profiles', '{id}']
   */
  resourcePath: string[];
  /** Whether to require auth (default: true) */
  requireAuth?: boolean;
  /**
   * Resource ownership validation configuration
   * Key is the resource table name, value is an object with:
   * - paramName: The path parameter name that contains the resource ID
   * - userField: The field in the table that should match the user ID (default: 'user_id')
   *
   * Example: { 'user_profiles': { paramName: 'id', userField: 'id' } }
   */
  ownershipValidation?: Record<string, { paramName: string; userField?: string }>;
}

/**
 * Generic user interface for Supabase Auth
 */
export interface SupabaseUser {
  id: string;
  email?: string;
  [key: string]: unknown;
}

/**
 * Generic Supabase client interface
 */
export interface SupabaseClientInterface {
  auth: {
    getUser(): Promise<{ data: { user: SupabaseUser | null }; error: Error | null }>;
  };
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        single: () => Promise<{ data: unknown; error: Error | null }>;
      };
    };
    update: (data: unknown) => {
      eq: (column: string, value: string) => {
        select: (columns: string) => {
          single: () => Promise<{ data: unknown; error: Error | null }>;
        };
      };
    };
    insert: (data: unknown) => {
      select: (columns: string) => {
        single: () => Promise<{ data: unknown; error: Error | null }>;
      };
    };
    delete: () => {
      eq: (column: string, value: string) => Promise<{ data: unknown; error: Error | null }>;
    };
  };
  [key: string]: unknown;
}

/**
 * Handler functions for different HTTP methods
 */
export interface MethodHandlers {
  GET?: (params: ApiHandlerContext) => Promise<Response>;
  POST?: (params: ApiHandlerContext) => Promise<Response>;
  PUT?: (params: ApiHandlerContext) => Promise<Response>;
  PATCH?: (params: ApiHandlerContext) => Promise<Response>;
  DELETE?: (params: ApiHandlerContext) => Promise<Response>;
}

/**
 * Context provided to API handler methods
 */
export interface ApiHandlerContext {
  /** The authenticated user object (if requireAuth is true) */
  user: SupabaseUser;
  /** The Supabase client instance */
  supabaseClient: SupabaseClientInterface;
  /** The parsed request object */
  req: Request;
  /** The extracted path parameters */
  params: Record<string, string>;
  /** Parsed URL for convenience */
  url: URL;
  /** Request info for error logging */
  requestInfo: ReturnType<typeof createRequestInfo>;
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

/**
 * Validates that a resource exists and belongs to the authenticated user
 */
export async function validateResourceOwnership(
  supabaseClient: SupabaseClientInterface,
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
 * Extracts dynamic path parameters from a URL based on a resource path pattern
 */
function extractPathParameters(
  url: URL,
  resourcePath: string[]
): Record<string, string> | null {
  const pathSegments = url.pathname.split('/').filter(segment => segment.length > 0);
  const params: Record<string, string> = {};

  // Must have enough segments
  if (pathSegments.length !== resourcePath.length) {
    return null;
  }

  // Match each segment against the pattern
  for (let i = 0; i < resourcePath.length; i++) {
    const pattern = resourcePath[i];
    const segment = pathSegments[i];

    // Dynamic parameter (in curly braces)
    if (pattern.startsWith('{') && pattern.endsWith('}')) {
      const paramName = pattern.slice(1, -1); // Remove curly braces
      params[paramName] = segment;
      continue;
    }

    // Static segment must match exactly
    if (pattern !== segment) {
      return null;
    }
  }

  return params;
}

/**
 * Creates a reusable API handler with authentication, parameter extraction, and error handling
 */
export function createApiHandler(
  createSupabaseClient: (req: Request) => SupabaseClientInterface,
  options: ApiHandlerOptions,
  methodHandlers: MethodHandlers
) {
  return async (req: Request) => {
    // Store request info for error logging
    const requestInfo = createRequestInfo(req);

    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }

    try {
      // Check if method is allowed
      if (!options.allowedMethods.includes(req.method)) {
        return createErrorResponse(
          405,
          'Method not allowed',
          { allowedMethods: options.allowedMethods },
          'METHOD_NOT_ALLOWED',
          undefined,
          requestInfo
        );
      }

      // Extract path parameters
      const url = new URL(req.url);
      const params = extractPathParameters(url, options.resourcePath);

      if (!params) {
        return createErrorResponse(
          404,
          'Resource not found',
          { expectedPath: options.resourcePath.join('/') },
          'RESOURCE_NOT_FOUND',
          undefined,
          requestInfo
        );
      }

      // Create Supabase client
      const supabaseClient = createSupabaseClient(req);

      // Handle authentication if required
      let user: SupabaseUser | undefined;
      if (options.requireAuth !== false) {
        const { data, error: authError } = await supabaseClient.auth.getUser();
        user = data?.user ?? undefined;

        if (authError || !user) {
          return createErrorResponse(
            401,
            'Unauthorized: Authentication required',
            undefined,
            'AUTH_REQUIRED',
            authError,
            requestInfo
          );
        }

        // Validate ownership for each resource in the ownership validation config
        if (options.ownershipValidation) {
          for (const [table, config] of Object.entries(options.ownershipValidation)) {
            const resourceId = params[config.paramName];
            const userField = config.userField || 'user_id';

            if (!resourceId) {
              return createErrorResponse(
                400,
                `Missing required path parameter: ${config.paramName}`,
                { params },
                'MISSING_PARAMETER',
                undefined,
                requestInfo
              );
            }

            const validationError = await validateResourceOwnership(
              supabaseClient,
              table,
              resourceId,
              userField,
              user.id,
              requestInfo
            );

            if (validationError) {
              return validationError;
            }
          }
        }
      }

      // Call the appropriate method handler
      const handlerContext: ApiHandlerContext = {
        user: user as SupabaseUser, // We know user exists if we get here and auth is required
        supabaseClient,
        req,
        params,
        url,
        requestInfo,
      };

      const methodHandler = methodHandlers[req.method as keyof MethodHandlers];
      if (!methodHandler) {
        return createErrorResponse(
          405,
          `Method ${req.method} not implemented`,
          { allowedMethods: options.allowedMethods },
          'METHOD_NOT_IMPLEMENTED',
          undefined,
          requestInfo
        );
      }

      return await methodHandler(handlerContext);
    } catch (error) {
      return createErrorResponse(
        500,
        'Internal server error',
        undefined,
        'SERVER_ERROR',
        error,
        requestInfo
      );
    }
  };
}
