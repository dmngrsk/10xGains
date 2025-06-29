import { PostgrestResponse, SupabaseClient } from '@supabase/supabase-js';

/**
 * Generates comprehensive test data for a user including exercises, plans, and session history
 * Returns batch operations to be executed via replace_collection_batch
 */
export async function scaffoldTestUserData(
  supabase: SupabaseClient,
  userId: string
): Promise<PostgrestResponse<unknown>> {
  // Step 1: Ensure exercises exist and get their IDs
  const [squatId, benchPressId, deadliftId] = await ensureExercisesExist(supabase);
  
  // Generate UUIDs for entities
  const planId = crypto.randomUUID();
  const dayAId = crypto.randomUUID();
  const dayBId = crypto.randomUUID();
  const squatExerciseAId = crypto.randomUUID();
  const benchPressExerciseId = crypto.randomUUID();
  const squatExerciseBId = crypto.randomUUID();
  const deadliftExerciseId = crypto.randomUUID();
  
  // Step 2: Create training plan
  const plans = [{
    id: planId,
    user_id: userId,
    name: 'Test Training Plan',
    description: 'Scaffolded training plan for testing.',
    created_at: '2025-04-27T10:00:00.000Z'
  }];

  // Step 3: Create plan days
  const planDays = [
    {
      id: dayAId,
      plan_id: planId,
      name: 'Workout A',
      description: 'Scaffolded workout A for testing.',
      order_index: 1
    },
    {
      id: dayBId,
      plan_id: planId,
      name: 'Workout B',
      description: 'Scaffolded workout B for testing.',
      order_index: 2
    }
  ];

  // Step 4: Create plan exercises
  const planExercises = [
    // Workout A exercises
    {
      id: squatExerciseAId,
      plan_day_id: dayAId,
      exercise_id: squatId,
      order_index: 1
    },
    {
      id: benchPressExerciseId,
      plan_day_id: dayAId,
      exercise_id: benchPressId,
      order_index: 2
    },
    // Workout B exercises
    {
      id: squatExerciseBId,
      plan_day_id: dayBId,
      exercise_id: squatId,
      order_index: 1
    },
    {
      id: deadliftExerciseId,
      plan_day_id: dayBId,
      exercise_id: deadliftId,
      order_index: 2
    }
  ];

  // Step 5: Create plan exercise sets
  const planExerciseSets = [
    // Workout A - Squat sets
    { id: crypto.randomUUID(), plan_exercise_id: squatExerciseAId, set_index: 1, expected_reps: 5, expected_weight: 100 },
    { id: crypto.randomUUID(), plan_exercise_id: squatExerciseAId, set_index: 2, expected_reps: 5, expected_weight: 100 },
    { id: crypto.randomUUID(), plan_exercise_id: squatExerciseAId, set_index: 3, expected_reps: 5, expected_weight: 100 },
    // Workout A - Bench press sets
    { id: crypto.randomUUID(), plan_exercise_id: benchPressExerciseId, set_index: 1, expected_reps: 5, expected_weight: 70 },
    { id: crypto.randomUUID(), plan_exercise_id: benchPressExerciseId, set_index: 2, expected_reps: 5, expected_weight: 70 },
    { id: crypto.randomUUID(), plan_exercise_id: benchPressExerciseId, set_index: 3, expected_reps: 5, expected_weight: 70 },
    // Workout B - Squat sets
    { id: crypto.randomUUID(), plan_exercise_id: squatExerciseBId, set_index: 1, expected_reps: 5, expected_weight: 100 },
    { id: crypto.randomUUID(), plan_exercise_id: squatExerciseBId, set_index: 2, expected_reps: 5, expected_weight: 100 },
    { id: crypto.randomUUID(), plan_exercise_id: squatExerciseBId, set_index: 3, expected_reps: 5, expected_weight: 100 },
    // Workout B - Deadlift set
    { id: crypto.randomUUID(), plan_exercise_id: deadliftExerciseId, set_index: 1, expected_reps: 5, expected_weight: 120 }
  ];

  // Step 6: Create progression rules
  const planExerciseProgressions = [
    {
      id: crypto.randomUUID(),
      plan_id: planId,
      exercise_id: squatId,
      weight_increment: 2.5,
      failure_count_for_deload: 3,
      deload_percentage: 10,
      deload_strategy: 'PROPORTIONAL',
      reference_set_index: null,
      consecutive_failures: 0,
      last_updated: '2025-04-27T10:00:00.000Z'
    },
    {
      id: crypto.randomUUID(),
      plan_id: planId,
      exercise_id: benchPressId,
      weight_increment: 2.5,
      failure_count_for_deload: 3,
      deload_percentage: 10,
      deload_strategy: 'PROPORTIONAL',
      reference_set_index: null,
      consecutive_failures: 0,
      last_updated: '2025-04-27T10:00:00.000Z'
    },
    {
      id: crypto.randomUUID(),
      plan_id: planId,
      exercise_id: deadliftId,
      weight_increment: 5,
      failure_count_for_deload: 3,
      deload_percentage: 10,
      deload_strategy: 'PROPORTIONAL',
      reference_set_index: null,
      consecutive_failures: 0,
      last_updated: '2025-04-27T10:00:00.000Z'
    }
  ];

  // Step 7: Create user profile
  const profiles = [{
    id: userId,
    first_name: 'Test User',
    active_plan_id: planId,
    ai_suggestions_remaining: 0,
    created_at: '2025-04-27T10:00:00.000Z',
    updated_at: '2025-04-27T10:00:00.000Z'
  }];

  // Step 8: Create sessions and session sets
  const { sessions, sessionSets } = generateSessionHistory(
    userId, planId, dayAId, dayBId, 
    squatExerciseAId, benchPressExerciseId, squatExerciseBId, deadliftExerciseId
  );

  const batchOperations = [
    { table_name: 'plans', records: plans },
    { table_name: 'plan_days', records: planDays },
    { table_name: 'plan_exercises', records: planExercises },
    { table_name: 'plan_exercise_sets', records: planExerciseSets },
    { table_name: 'plan_exercise_progressions', records: planExerciseProgressions },
    { table_name: 'profiles', records: profiles },
    { table_name: 'sessions', records: sessions },
    { table_name: 'session_sets', records: sessionSets }
  ];
     
  return await supabase!.rpc('replace_collections_batch', {
    p_operations: batchOperations.filter(op => op.records.length > 0)
  });
}

// Cache for exercise IDs to avoid repeated queries in the same test run
let cachedExerciseIds: [string, string, string] | null = null;

async function ensureExercisesExist(supabase: SupabaseClient): Promise<[string, string, string]> {
  // Return cached results if available
  if (cachedExerciseIds) {
    return cachedExerciseIds;
  }

  const requiredExercises = ['Squat', 'Bench Press', 'Deadlift'];
  
  // Single query to fetch all required exercises at once
  const { data: existingExercises, error: fetchError } = await supabase
    .from('exercises')
    .select('id, name')
    .in('name', requiredExercises);

  if (fetchError) throw fetchError;

  // Create a map of existing exercises by name
  const existingExerciseMap = new Map(
    (existingExercises || []).map(ex => [ex.name, ex.id])
  );

  // Identify missing exercises
  const missingExercises = requiredExercises.filter(
    name => !existingExerciseMap.has(name)
  );

  // Create missing exercises in a single batch insert if any are missing
  if (missingExercises.length > 0) {
    const exercisesToInsert = missingExercises.map(name => ({
      name,
      description: null
    }));

    const { data: newExercises, error: createError } = await supabase
      .from('exercises')
      .insert(exercisesToInsert)
      .select('id, name');

    if (createError) throw createError;

    // Add newly created exercises to the map
    newExercises?.forEach(exercise => {
      existingExerciseMap.set(exercise.name, exercise.id);
    });
  }

  // Build the result tuple in the required order
  const squatId = existingExerciseMap.get('Squat');
  const benchPressId = existingExerciseMap.get('Bench Press');
  const deadliftId = existingExerciseMap.get('Deadlift');

  if (!squatId || !benchPressId || !deadliftId) {
    throw new Error('Failed to ensure all required exercises exist');
  }

  // Cache the results for subsequent calls
  cachedExerciseIds = [squatId, benchPressId, deadliftId];
  
  return cachedExerciseIds;
}

function generateSessionHistory(
  userId: string,
  planId: string,
  dayAId: string,
  dayBId: string,
  squatExerciseAId: string,
  benchPressExerciseId: string,
  squatExerciseBId: string,
  deadliftExerciseId: string
): { sessions: Record<string, unknown>[]; sessionSets: Record<string, unknown>[] } {
  const sessions: Record<string, unknown>[] = [];
  const sessionSets: Record<string, unknown>[] = [];

  // Create current pending session
  const pendingSessionId = crypto.randomUUID();
  sessions.push({
    id: pendingSessionId,
    user_id: userId,
    plan_id: planId,
    plan_day_id: dayAId,
    session_date: null,
    status: 'PENDING'
  });

  // Create pending session sets for workout A
  const pendingSets = [
    // Squat sets
    { id: crypto.randomUUID(), session_id: pendingSessionId, plan_exercise_id: squatExerciseAId, set_index: 1, actual_weight: 100, actual_reps: null, expected_reps: 5, status: 'PENDING', completed_at: null },
    { id: crypto.randomUUID(), session_id: pendingSessionId, plan_exercise_id: squatExerciseAId, set_index: 2, actual_weight: 100, actual_reps: null, expected_reps: 5, status: 'PENDING', completed_at: null },
    { id: crypto.randomUUID(), session_id: pendingSessionId, plan_exercise_id: squatExerciseAId, set_index: 3, actual_weight: 100, actual_reps: null, expected_reps: 5, status: 'PENDING', completed_at: null },
    // Bench press sets
    { id: crypto.randomUUID(), session_id: pendingSessionId, plan_exercise_id: benchPressExerciseId, set_index: 1, actual_weight: 70, actual_reps: null, expected_reps: 5, status: 'PENDING', completed_at: null },
    { id: crypto.randomUUID(), session_id: pendingSessionId, plan_exercise_id: benchPressExerciseId, set_index: 2, actual_weight: 70, actual_reps: null, expected_reps: 5, status: 'PENDING', completed_at: null },
    { id: crypto.randomUUID(), session_id: pendingSessionId, plan_exercise_id: benchPressExerciseId, set_index: 3, actual_weight: 70, actual_reps: null, expected_reps: 5, status: 'PENDING', completed_at: null }
  ];

  sessionSets.push(...pendingSets);

  // Create 14 historical sessions
  let sessionDate = new Date('2025-06-01T12:00:00.000Z');
  let squatWeight = 97.5; // Start lower to simulate progression
  let benchPressWeight = 67.5;
  let deadliftWeight = 115;

  for (let i = 1; i <= 14; i++) {
    const daysGap = i % 3 === 0 ? 3 : 2;
    sessionDate = new Date(sessionDate.getTime() - (daysGap * 24 * 60 * 60 * 1000));
    
    const isWorkoutA = i % 2 === 0;
    const currentDayId = isWorkoutA ? dayAId : dayBId;
    const historicalSessionId = crypto.randomUUID();

    sessions.push({
      id: historicalSessionId,
      user_id: userId,
      plan_id: planId,
      plan_day_id: currentDayId,
      session_date: sessionDate.toISOString(),
      status: 'COMPLETED'
    });

    if (isWorkoutA) {
      // Workout A sets (squat + bench press)
      const workoutASets = [
        // Squat sets
        { id: crypto.randomUUID(), session_id: historicalSessionId, plan_exercise_id: squatExerciseAId, set_index: 1, actual_weight: squatWeight, actual_reps: 5, expected_reps: 5, status: 'COMPLETED', completed_at: sessionDate.toISOString() },
        { id: crypto.randomUUID(), session_id: historicalSessionId, plan_exercise_id: squatExerciseAId, set_index: 2, actual_weight: squatWeight, actual_reps: 5, expected_reps: 5, status: 'COMPLETED', completed_at: new Date(sessionDate.getTime() + 5 * 60 * 1000).toISOString() },
        { id: crypto.randomUUID(), session_id: historicalSessionId, plan_exercise_id: squatExerciseAId, set_index: 3, actual_weight: squatWeight, actual_reps: 5, expected_reps: 5, status: 'COMPLETED', completed_at: new Date(sessionDate.getTime() + 10 * 60 * 1000).toISOString() },
        // Bench press sets
        { id: crypto.randomUUID(), session_id: historicalSessionId, plan_exercise_id: benchPressExerciseId, set_index: 1, actual_weight: benchPressWeight, actual_reps: 5, expected_reps: 5, status: 'COMPLETED', completed_at: new Date(sessionDate.getTime() + 15 * 60 * 1000).toISOString() },
        { id: crypto.randomUUID(), session_id: historicalSessionId, plan_exercise_id: benchPressExerciseId, set_index: 2, actual_weight: benchPressWeight, actual_reps: 5, expected_reps: 5, status: 'COMPLETED', completed_at: new Date(sessionDate.getTime() + 20 * 60 * 1000).toISOString() },
        { id: crypto.randomUUID(), session_id: historicalSessionId, plan_exercise_id: benchPressExerciseId, set_index: 3, actual_weight: benchPressWeight, actual_reps: 5, expected_reps: 5, status: 'COMPLETED', completed_at: new Date(sessionDate.getTime() + 25 * 60 * 1000).toISOString() }
      ];

      sessionSets.push(...workoutASets);
      
      squatWeight -= 2.5;
      benchPressWeight -= 2.5;
    } else {
      // Workout B sets (squat + deadlift)
      const workoutBSets = [
        // Squat sets
        { id: crypto.randomUUID(), session_id: historicalSessionId, plan_exercise_id: squatExerciseBId, set_index: 1, actual_weight: squatWeight, actual_reps: 5, expected_reps: 5, status: 'COMPLETED', completed_at: sessionDate.toISOString() },
        { id: crypto.randomUUID(), session_id: historicalSessionId, plan_exercise_id: squatExerciseBId, set_index: 2, actual_weight: squatWeight, actual_reps: 5, expected_reps: 5, status: 'COMPLETED', completed_at: new Date(sessionDate.getTime() + 5 * 60 * 1000).toISOString() },
        { id: crypto.randomUUID(), session_id: historicalSessionId, plan_exercise_id: squatExerciseBId, set_index: 3, actual_weight: squatWeight, actual_reps: 5, expected_reps: 5, status: 'COMPLETED', completed_at: new Date(sessionDate.getTime() + 10 * 60 * 1000).toISOString() },
        // Deadlift set
        { id: crypto.randomUUID(), session_id: historicalSessionId, plan_exercise_id: deadliftExerciseId, set_index: 1, actual_weight: deadliftWeight, actual_reps: 5, expected_reps: 5, status: 'COMPLETED', completed_at: new Date(sessionDate.getTime() + 15 * 60 * 1000).toISOString() }
      ];

      sessionSets.push(...workoutBSets);
      
      squatWeight -= 2.5;
      deadliftWeight -= 5;
    }
  }

  return { sessions, sessionSets };
}
