// Supabase Edge Function for User Profiles API Endpoint
// Handles GET and PUT requests to /profiles/{id}

import { serve } from 'std/http/server.ts';
import { createClient } from 'supabase';
import { z } from 'zod';
import { UserProfileDto, UpdateUserProfileCommand } from 'shared/api-types.ts';
import {
  createApiHandler,
  createErrorResponse,
  createSuccessResponse,
  ApiHandlerContext,
  SupabaseClientInterface
} from 'shared/api-helpers.ts';
import { Database } from 'shared/database-types.ts';

// Define validation schema for the UpdateUserProfileCommand
const updateUserProfileSchema = z.object({
  first_name: z.string().min(1).optional(),
  active_training_plan_id: z.string().uuid().optional(),
});

// Create a function to initialize the Supabase client
const createSupabaseClient = (req: Request): SupabaseClientInterface => {
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

// Handler for GET requests to retrieve user profile
async function handleGetUserProfile(
  { supabaseClient, params, requestInfo }: ApiHandlerContext
): Promise<Response> {
  try {
    const userId = params.id;

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
  { supabaseClient, params, req, requestInfo }: ApiHandlerContext
): Promise<Response> {
  try {
    const userId = params.id;

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

// Define the API handler for profiles endpoint
const apiHandler = createApiHandler(
  createSupabaseClient,
  {
    allowedMethods: ['GET', 'PUT'],
    resourcePath: ['profiles', '{id}'],
    requireAuth: true,
    ownershipValidation: {
      // This validates that the user can only access their own profile
      // by checking that the ID in the URL matches their user ID
      'user_profiles': { paramName: 'id', userField: 'id' }
    }
  },
  {
    GET: handleGetUserProfile,
    PUT: handleUpdateUserProfile
  }
);

// Export the API handler for the Deno runtime
serve(apiHandler);
