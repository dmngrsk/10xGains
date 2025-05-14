import { corsHeaders, createRequestInfo, createErrorResponse, createSupabaseClient, type SupabaseUser } from '../utils/api-helpers.ts';
import type { SupabaseClient } from 'supabase';
import type { Database } from '../models/database-types.ts';

/**
 * A special symbol to indicate that the current route handler did not match the request,
 * and the main router should try the next handler.
 */
export const PASS_ROUTE_INDICATOR = Symbol('PASS_ROUTE_INDICATOR');

/**
 * Context provided to API method handlers (GET, POST, etc.).
 */
export interface ApiHandlerContext {
  user?: SupabaseUser; // Optional: The authenticated user, if auth is required and successful.
  supabaseClient: SupabaseClient<Database>; // The Supabase client instance, typed with Database.
  req: Request; // The original Deno request object.
  rawPathParams?: Record<string, string | undefined>; // Raw parameters extracted by URLPattern.
  url: URL; // Parsed URL of the request.
  requestInfo: ReturnType<typeof createRequestInfo>; // Standardized request info for logging.
}

/**
 * Defines the structure for a map of HTTP methods to their handler functions.
 */
export interface MethodHandlers {
  GET?: (context: ApiHandlerContext) => Promise<Response>;
  POST?: (context: ApiHandlerContext) => Promise<Response>;
  PUT?: (context: ApiHandlerContext) => Promise<Response>;
  PATCH?: (context: ApiHandlerContext) => Promise<Response>;
  DELETE?: (context: ApiHandlerContext) => Promise<Response>;
  OPTIONS?: (context: ApiHandlerContext) => Promise<Response>; // Explicit OPTIONS handling if needed per-route
}

/**
 * Type for the individual route aggregator functions (e.g., handleTrainingPlansRoute)
 * that are iterated by the main function router (e.g., training-plans/index.ts).
 */
export type ApiRouterHandler = (
  req: Request,
  context: ApiHandlerContext
) => Promise<Response | typeof PASS_ROUTE_INDICATOR>;

/**
 * Matches an absolute path, handles auth, and dispatches to method handlers.
 * This is intended to be called by the specific route modules (e.g., handleTrainingPlansRoute from a handler.ts file).
 */
export async function routeRequestToMethods(
  req: Request,
  absolutePathPattern: string,
  methodHandlers: MethodHandlers,
  context: ApiHandlerContext,
  requireAuth = true
): Promise<Response | typeof PASS_ROUTE_INDICATOR> {
  const pattern = new URLPattern({ pathname: absolutePathPattern });
  const pathMatch = pattern.exec(context.url.pathname, context.url.origin);

  if (!pathMatch) {
    return PASS_ROUTE_INDICATOR;
  }

  context.rawPathParams = pathMatch.pathname.groups;

  if (req.method === 'OPTIONS') {
    // Prefer specific OPTIONS handler if provided for the route
    if (methodHandlers.OPTIONS) {
      return await methodHandlers.OPTIONS(context);
    }
    // Generic OPTIONS response for the matched path
    const allowMethods = Object.keys(methodHandlers).filter(m => m !== 'OPTIONS').join(', ');
    return new Response(null, {
      status: 204,
      headers: {
        ...corsHeaders,
        'Access-Control-Allow-Methods': allowMethods || 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
      },
    });
  }

  const handlerMethod = methodHandlers[req.method as keyof MethodHandlers];
  if (!handlerMethod) {
    return PASS_ROUTE_INDICATOR;
  }

  if (requireAuth) {
    const { data: { user: sessionUser }, error: authError } = await context.supabaseClient.auth.getUser();
    if (authError || !sessionUser) {
      console.error('Auth error or no user in session:', authError?.message);
      return createErrorResponse(401, 'Authentication required', { details: authError?.message || 'No user session' }, 'AUTH_REQUIRED', authError, context.requestInfo);
    }

    context.user = { id: sessionUser.id, email: sessionUser.email };
  }

  try {
    console.log('handling', req.method, context.url.pathname);
    return await handlerMethod(context);
  } catch (e) {
    console.error(`Error in handler method for ${req.method} ${absolutePathPattern}:`, e);
    return createErrorResponse(
      500,
      'Internal Server Error in method handler',
      { details: (e instanceof Error) ? e.message : String(e) },
      'METHOD_HANDLER_ERROR',
      e,
      context.requestInfo
    );
  }
}

/**
 * Creates a main request handler for a Supabase Function.
 * This handler iterates through a list of specific route handlers.
 */
export function createMainRouterHandler(
  routeHandlers: ApiRouterHandler[],
  functionMountPath: string // For logging and generic OPTIONS scope
) {
  return async (req: Request): Promise<Response> => {
    // Generic OPTIONS handling for the function's base path.
    // More specific OPTIONS are handled by routeRequestToMethods for matched routes.
    if (req.method === 'OPTIONS') {
      // Check if the OPTIONS request is for the exact mount path or a sub-path.
      // A simple catch-all for the function might be too broad if sub-routes have specific OPTIONS.
      // However, routeRequestToMethods already handles specific OPTIONS for matched routes.
      // This can be a fallback or for the bare function URL.
      return new Response(null, {
        status: 204,
        headers: {
          ...corsHeaders, // Using imported corsHeaders
          // 'Access-Control-Allow-Methods' can be kept broad here, or be more dynamic
          // based on methods available across all routeHandlers if desired (more complex).
        },
      });
    }

    const supabaseClient = createSupabaseClient(req);

    for (const handler of routeHandlers) {
      const url = new URL(req.url);
      const requestInfo = createRequestInfo(req);
      const context: ApiHandlerContext = {
        supabaseClient,
        req,
        url,
        requestInfo,
        // user and rawPathParams will be added by routeRequestToMethods or auth middleware
      };
      const response = await handler(req, context);
      if (response !== PASS_ROUTE_INDICATOR) {
        return response;
      }
    }

    const requestInfo = createRequestInfo(req);
    console.warn(`No handler matched for ${req.method} ${req.url} (function mount: ${functionMountPath})`);
    return createErrorResponse(
      404,
      `The requested endpoint was not found within the ${functionMountPath} function scope.`,
      undefined,
      'NOT_FOUND',
      undefined,
      requestInfo
    );
  };
}