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
 * Identifies an ordered collection and how to read and write its ordering.
 *
 * @template T - The type of the entities in the collection.
 */
export interface CollectionConfig<T> {
  /** The database table holding the collection. */
  table: string;
  /** The foreign key column that groups the collection. */
  parentColumn: string;
  /** The value of that column for this collection. */
  parentId: string;
  /** The column holding the 1-based position within the collection. */
  orderColumn: string;
  /** Extracts an entity's id. */
  getId: (entity: T) => string;
  /** Extracts an entity's current position. */
  getOrder: (entity: T) => number | undefined | null;
  /** Returns a copy of the entity at a new position. */
  setOrder: (entity: T, newOrder: number) => T;
  /** An optional second filter, for collections with a compound key. */
  scope?: CollectionScope;
}

/**
 * Replaces an ordered collection, applying a mutation and renormalizing the ordering.
 *
 * All three collection operations - create, update and delete - are the same transaction with a
 * different mutation in the middle: read the current members, produce the new membership, then
 * write it back atomically with positions renumbered 1..N. Only that middle step differs, so it is
 * the only thing the callers below supply.
 *
 * @template T - The type of the entities being managed.
 * @param {SupabaseClient<Database>} supabase - The authenticated Supabase client.
 * @param {CollectionConfig<T>} config - The collection to operate on.
 * @param {(existing: T[]) => T[]} mutate - Produces the new membership from the current one.
 * @returns {Promise<T[]>} A promise that resolves to the updated collection.
 */
async function replaceCollection<T>(
  supabase: SupabaseClient<Database>,
  config: CollectionConfig<T>,
  mutate: (existing: T[]) => T[]
): Promise<T[]> {
  const { table, parentColumn, parentId, orderColumn, scope } = config;

  const collectionQuery = supabase
    .from(table)
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

  const normalizedEntities = mutate((existingEntities ?? []) as unknown as T[]);

  const { data: result, error } = await supabase.rpc('replace_collection', {
    p_table_name: table,
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
 * Creates a new entity within a collection with normalized ordering.
 *
 * The entity's requested position is honoured: an absent order appends, `<= 0` prepends, and any
 * other value inserts at that 1-based index, with the rest of the collection shifted around it.
 *
 * @template T - The type of the entities being managed.
 * @param {SupabaseClient<Database>} supabase - The authenticated Supabase client.
 * @param {CollectionConfig<T>} config - The collection to insert into.
 * @param {T} newEntity - The new entity data.
 * @returns {Promise<T[]>} A promise that resolves to the updated collection.
 *
 * @example
 * ```typescript
 * const updatedDays = await createEntityInCollection<PlanDayDto>(supabaseClient, {
 *   table: 'plan_days',
 *   parentColumn: 'plan_id',
 *   parentId: planId,
 *   orderColumn: 'order_index',
 *   getId: (d) => d.id,
 *   getOrder: (d) => d.order_index,
 *   setOrder: (d, order) => ({ ...d, order_index: order }),
 * }, newDayData);
 * ```
 */
export function createEntityInCollection<T>(
  supabase: SupabaseClient<Database>,
  config: CollectionConfig<T>,
  newEntity: T
): Promise<T[]> {
  return replaceCollection(supabase, config, existing =>
    insertAndNormalizeOrder(existing, newEntity, config.getId, config.getOrder, config.setOrder)
  );
}

/**
 * Updates an entity within a collection with normalized ordering.
 *
 * Changing the entity's order value moves it, and the surrounding entities are renumbered to close
 * the gap it left and open one where it lands.
 *
 * @template T - The type of the entities being managed.
 * @param {SupabaseClient<Database>} supabase - The authenticated Supabase client.
 * @param {CollectionConfig<T>} config - The collection to update within.
 * @param {T} updatedEntity - The updated entity data.
 * @returns {Promise<T[]>} A promise that resolves to the updated collection.
 */
export function updateEntityInCollection<T>(
  supabase: SupabaseClient<Database>,
  config: CollectionConfig<T>,
  updatedEntity: T
): Promise<T[]> {
  return replaceCollection(supabase, config, existing =>
    insertAndNormalizeOrder(existing, updatedEntity, config.getId, config.getOrder, config.setOrder)
  );
}

/**
 * Deletes an entity from a collection, closing the gap it leaves in the ordering.
 *
 * @template T - The type of the entities being managed.
 * @param {SupabaseClient<Database>} supabase - The authenticated Supabase client.
 * @param {CollectionConfig<T>} config - The collection to delete from.
 * @param {string} entityId - The ID of the entity to delete.
 * @returns {Promise<T[]>} A promise that resolves to the updated collection.
 */
export function deleteEntityFromCollection<T>(
  supabase: SupabaseClient<Database>,
  config: CollectionConfig<T>,
  entityId: string
): Promise<T[]> {
  return replaceCollection(supabase, config, existing =>
    insertAndNormalizeOrder(
      existing.filter(entity => config.getId(entity) !== entityId),
      null,
      config.getId,
      config.getOrder,
      config.setOrder
    )
  );
}
