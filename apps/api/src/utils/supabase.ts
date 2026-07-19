import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@txg/shared';
import { insertAndNormalizeOrder } from '../services/index-order/index-order';

/**
 * An additional filter that narrows a collection beyond its parent column.
 *
 * Some collections are only uniquely identified by a compound key. Session sets, for example, are
 * keyed by `plan_exercise_id`, but that column is shared by every session ever trained from the
 * same plan day - so the parent filter alone would pull in (and renumber, and rewrite) the sets of
 * historical sessions. Passing `{ column: 'session_id', id: sessionId }` restricts every phase of
 * the operation - the sibling pre-fetch, the delete, the order normalization and the select-back -
 * to the one session's sets.
 */
export interface CollectionScope {
  /** The column to filter on, in addition to the parent column. */
  column: string;
  /** The value that column must equal. */
  id: string;
}

/**
 * Creates a new entity within a collection with normalized ordering.
 *
 * This function handles the creation of new entities within collections while maintaining
 * proper ordering through client-side normalization and database-side transactional updates.
 *
 * @template T - The type of the entities being managed
 * @param {SupabaseClient<Database>} supabase - The authenticated Supabase client
 * @param {string} tableName - The name of the database table
 * @param {string} parentColumn - The name of the foreign key column
 * @param {string} parentId - The ID of the parent record
 * @param {T} newEntity - The new entity data
 * @param {(entity: T) => string} getId - Function to extract the ID from an entity
 * @param {(entity: T) => number | undefined | null} getOrder - Function to extract the order index from an entity
 * @param {(entity: T, newOrder: number) => T} setOrder - Function to set a new order index on an entity
 * @param {CollectionScope} [scope] - Optional secondary filter for collections with a compound key
 * @returns {Promise<T[]>} A promise that resolves to the updated collection
 *
 * @example
 * ```typescript
 * const updatedDays = await createEntityInCollection<PlanDayDto>(
 *   supabaseClient,
 *   'plan_days',
 *   'plan_id',
 *   planId,
 *   'order_index',
 *   newDayData,
 *   (d) => d.id,
 *   (d) => d.order_index,
 *   (d, order) => ({ ...d, order_index: order })
 * );
 * ```
 */
export async function createEntityInCollection<T>(
  supabase: SupabaseClient<Database>,
  tableName: string,
  parentColumn: string,
  parentId: string,
  orderColumn: string,
  newEntity: T,
  getId: (entity: T) => string,
  getOrder: (entity: T) => number | undefined | null,
  setOrder: (entity: T, newOrder: number) => T,
  scope?: CollectionScope
): Promise<T[]> {
  const collectionQuery = supabase
    .from(tableName)
    .select('*')
    .eq(parentColumn, parentId);

  if (scope) {
    collectionQuery.eq(scope.column, scope.id);
  }

  const { data: existingEntities, error: fetchError } = await collectionQuery
    .order(orderColumn, { ascending: true });

  if (fetchError) {
    throw fetchError;
  }

  const typedExistingEntities = existingEntities as unknown as T[];
  const normalizedEntities = insertAndNormalizeOrder(
    typedExistingEntities || [],
    newEntity,
    getId,
    getOrder,
    setOrder
  );

  const { data: result, error } = await supabase.rpc('replace_collection', {
    p_table_name: tableName,
    p_parent_column: parentColumn,
    p_parent_id: parentId,
    p_order_column: orderColumn,
    p_records: normalizedEntities as Json,
    ...(scope ? { p_scope_column: scope.column, p_scope_id: scope.id } : {})
  });

  if (error) {
    throw error;
  }

  return (Array.isArray(result) ? result : [result]) as T[];
}

/**
 * Updates an entity within a collection with normalized ordering.
 *
 * This function handles updating entities within collections while maintaining
 * proper ordering through client-side normalization and database-side transactional updates.
 *
 * @template T - The type of the entities being managed
 * @param {SupabaseClient<Database>} supabase - The authenticated Supabase client
 * @param {string} tableName - The name of the database table
 * @param {string} parentColumn - The name of the foreign key column
 * @param {string} parentId - The ID of the parent record
 * @param {T} updatedEntity - The updated entity data
 * @param {(entity: T) => string} getId - Function to extract the ID from an entity
 * @param {(entity: T) => number | undefined | null} getOrder - Function to extract the order index from an entity
 * @param {(entity: T, newOrder: number) => T} setOrder - Function to set a new order index on an entity
 * @param {CollectionScope} [scope] - Optional secondary filter for collections with a compound key
 * @returns {Promise<T[]>} A promise that resolves to the updated collection
 *
 * @example
 * ```typescript
 * const updatedDays = await updateEntityInCollection<PlanDayDto>(
 *   supabaseClient,
 *   'plan_days',
 *   'plan_id',
 *   planId,
 *   'order_index',
 *   updatedDayData,
 *   (d) => d.id,
 *   (d) => d.order_index,
 *   (d, order) => ({ ...d, order_index: order })
 * );
 * ```
 */
export async function updateEntityInCollection<T>(
  supabase: SupabaseClient<Database>,
  tableName: string,
  parentColumn: string,
  parentId: string,
  orderColumn: string,
  updatedEntity: T,
  getId: (entity: T) => string,
  getOrder: (entity: T) => number | undefined | null,
  setOrder: (entity: T, newOrder: number) => T,
  scope?: CollectionScope
): Promise<T[]> {
  const collectionQuery = supabase
    .from(tableName)
    .select('*')
    .eq(parentColumn, parentId);

  if (scope) {
    collectionQuery.eq(scope.column, scope.id);
  }

  const { data: existingEntities, error: fetchError } = await collectionQuery
    .order(orderColumn, { ascending: true });

  if (fetchError) {
    throw fetchError;
  }

  const typedExistingEntities = existingEntities as unknown as T[];
  const normalizedEntities = insertAndNormalizeOrder(
    typedExistingEntities || [],
    updatedEntity,
    getId,
    getOrder,
    setOrder
  );

  const { data: result, error } = await supabase.rpc('replace_collection', {
    p_table_name: tableName,
    p_parent_column: parentColumn,
    p_parent_id: parentId,
    p_order_column: orderColumn,
    p_records: normalizedEntities as Json,
    ...(scope ? { p_scope_column: scope.column, p_scope_id: scope.id } : {})
  });

  if (error) {
    throw error;
  }

  return (Array.isArray(result) ? result : [result]) as T[];
}

/**
 * Deletes an entity from a collection with normalized ordering.
 *
 * This function handles deleting entities from collections while maintaining
 * proper ordering through client-side normalization and database-side transactional updates.
 *
 * @template T - The type of the entities being managed
 * @param {SupabaseClient<Database>} supabase - The authenticated Supabase client
 * @param {string} tableName - The name of the database table
 * @param {string} parentColumn - The name of the foreign key column
 * @param {string} parentId - The ID of the parent record
 * @param {string} entityId - The ID of the entity to delete
 * @param {(entity: T) => string} getId - Function to extract the ID from an entity
 * @param {(entity: T) => number | undefined | null} getOrder - Function to extract the order index from an entity
 * @param {(entity: T, newOrder: number) => T} setOrder - Function to set a new order index on an entity
 * @param {CollectionScope} [scope] - Optional secondary filter for collections with a compound key
 * @returns {Promise<T[]>} A promise that resolves to the updated collection
 *
 * @example
 * ```typescript
 * const updatedDays = await deleteEntityFromCollection<PlanDayDto>(
 *   supabaseClient,
 *   'plan_days',
 *   'plan_id',
 *   planId,
 *   'order_index',
 *   dayId,
 *   (d) => d.id,
 *   (d) => d.order_index,
 *   (d, order) => ({ ...d, order_index: order })
 * );
 * ```
 */
export async function deleteEntityFromCollection<T>(
  supabase: SupabaseClient<Database>,
  tableName: string,
  parentColumn: string,
  parentId: string,
  orderColumn: string,
  entityId: string,
  getId: (entity: T) => string,
  getOrder: (entity: T) => number | undefined | null,
  setOrder: (entity: T, newOrder: number) => T,
  scope?: CollectionScope
): Promise<T[]> {
  const collectionQuery = supabase
    .from(tableName)
    .select('*')
    .eq(parentColumn, parentId);

  if (scope) {
    collectionQuery.eq(scope.column, scope.id);
  }

  const { data: existingEntities, error: fetchError } = await collectionQuery
    .order(orderColumn, { ascending: true });

  if (fetchError) {
    throw fetchError;
  }

  const typedExistingEntities = existingEntities as unknown as T[];
  const filteredEntities = (typedExistingEntities || []).filter(entity => getId(entity) !== entityId);

  const normalizedEntities = insertAndNormalizeOrder(
    filteredEntities,
    null,
    getId,
    getOrder,
    setOrder
  );

  const { data: result, error } = await supabase.rpc('replace_collection', {
    p_table_name: tableName,
    p_parent_column: parentColumn,
    p_parent_id: parentId,
    p_order_column: orderColumn,
    p_records: normalizedEntities as Json,
    ...(scope ? { p_scope_column: scope.column, p_scope_id: scope.id } : {})
  });

  if (error) {
    throw error;
  }

  return (Array.isArray(result) ? result : [result]) as T[];
}
