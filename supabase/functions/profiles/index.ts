// Supabase Edge Function for User Profiles API Endpoint
// Handles GET and PUT requests to /profiles/{id}

import { serve } from 'std/http/server.ts';
import { createClient, SupabaseClient } from 'supabase';
import { z } from 'zod';
import { UserProfileDto, UpdateUserProfileCommand } from 'shared/api-types.ts';
import { corsHeaders, createErrorResponse, createSuccessResponse, createRequestInfo } from 'shared/api-helpers.ts';
import { Database } from 'shared/database-types.ts';

// Define validation schema for the UpdateUserProfileCommand
const updateUserProfileSchema = z.object({
  first_name: z.string().min(1).optional(),
  active_training_plan_id: z.string().uuid().optional(),
});

// UUID validation regex
const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Main handler for the API endpoint
serve(async (req: Request) => {
  // Store request info for error logging
  const requestInfo = createRequestInfo(req);

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Extract the user ID from the URL path
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const idIndex = pathParts.findIndex((part) => part === 'profiles') + 1;

    if (idIndex <= 0 || idIndex >= pathParts.length) {
      return createErrorResponse(
        400,
        'Invalid URL path. Expected /profiles/{id}',
        undefined,
        'INVALID_PATH',
        undefined,
        requestInfo
      );
    }

    const userId = pathParts[idIndex];

    // Validate that userId is a valid UUID before proceeding
    if (!uuidRegex.test(userId)) {
      return createErrorResponse(
        400,
        'Invalid user ID format. Must be a valid UUID.',
        undefined,
        'INVALID_UUID',
        undefined,
        requestInfo
      );
    }

    // Create Supabase client
    const supabaseClient = createClient<Database>(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Authenticate the user
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser();

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

    // Verify that the user is only accessing their own profile
    if (user.id !== userId) {
      return createErrorResponse(
        403,
        "Forbidden: Cannot access another user's profile",
        { requestedId: userId, userId: user.id },
        'FORBIDDEN_ACCESS',
        undefined,
        requestInfo
      );
    }

    // Handle the request based on the HTTP method
    switch (req.method) {
      case 'GET':
        return await handleGetUserProfile(supabaseClient, userId, requestInfo);
      case 'PUT':
        return await handleUpdateUserProfile(supabaseClient, userId, req, requestInfo);
      default:
        return createErrorResponse(
          405,
          'Method not allowed',
          { allowedMethods: ['GET', 'PUT'] },
          'METHOD_NOT_ALLOWED',
          undefined,
          requestInfo
        );
    }
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
});

// Handler for GET requests to retrieve user profile
async function handleGetUserProfile(
  supabaseClient: SupabaseClient<Database>,
  userId: string,
  requestInfo: ReturnType<typeof createRequestInfo>
): Promise<Response> {
  try {
    const { data, error } = await supabaseClient
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      return createErrorResponse(
        500,
        'Error fetching user profile',
        undefined,
        'DB_ERROR',
        error,
        requestInfo
      );
    }

    if (!data) {
      return createErrorResponse(
        404,
        'User profile not found',
        { userId },
        'PROFILE_NOT_FOUND',
        undefined,
        requestInfo
      );
    }

    // Return the profile data as UserProfileDto
    const userProfile: UserProfileDto = data;

    return createSuccessResponse(userProfile);
  } catch (error) {
    return createErrorResponse(
      500,
      'Error processing user profile request',
      undefined,
      'PROFILE_REQUEST_ERROR',
      error,
      requestInfo
    );
  }
}

// Handler for PUT requests to create or update user profile
async function handleUpdateUserProfile(
  supabaseClient: SupabaseClient<Database>,
  userId: string,
  req: Request,
  requestInfo: ReturnType<typeof createRequestInfo>
): Promise<Response> {
  try {
    // Parse and validate request body
    const requestBody = await req.json();
    const validationResult = updateUserProfileSchema.safeParse(requestBody);

    if (!validationResult.success) {
      return createErrorResponse(
        400,
        'Invalid input data',
        { validationErrors: validationResult.error.format() },
        'VALIDATION_ERROR',
        undefined,
        requestInfo
      );
    }

    const validatedData: UpdateUserProfileCommand = validationResult.data;

    // Check if profile exists first
    const { data: existingProfile } = await supabaseClient
      .from('user_profiles')
      .select('id')
      .eq('id', userId)
      .single();

    let operation;

    if (existingProfile) {
      // Update existing profile
      operation = supabaseClient
        .from('user_profiles')
        .update(validatedData)
        .eq('id', userId)
        .select('*')
        .single();
    } else {
      // Create new profile with required fields
      operation = supabaseClient
        .from('user_profiles')
        .insert({
          id: userId,
          first_name: validatedData.first_name || 'New User', // Provide a default if not specified
          active_training_plan_id: validatedData.active_training_plan_id,
        })
        .select('*')
        .single();
    }

    // Execute the operation
    const { data, error } = await operation;

    if (error) {
      return createErrorResponse(
        500,
        existingProfile ? 'Error updating user profile' : 'Error creating user profile',
        undefined,
        existingProfile ? 'DB_UPDATE_ERROR' : 'DB_INSERT_ERROR',
        error,
        requestInfo
      );
    }

    // Return the updated/created profile as UserProfileDto
    const profileDto: UserProfileDto = data;

    return createSuccessResponse(
      profileDto,
      existingProfile ? 'User profile updated successfully' : 'User profile created successfully',
      existingProfile ? 200 : 201 // 201 Created status for new profiles
    );
  } catch (error) {
    return createErrorResponse(
      400,
      'Error processing update/create request',
      undefined,
      'REQUEST_ERROR',
      error,
      requestInfo
    );
  }
}
