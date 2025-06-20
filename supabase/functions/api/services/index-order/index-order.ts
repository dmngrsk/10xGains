/**
 * Inserts or updates an entity in a list and normalizes the order_index or set_index.
 * The target index for `entityToUpsert` is determined by `entityIndexSelector(entityToUpsert)`.
 * - If undefined/null: appends to the end.
 * - If <= 0: prepends to the beginning.
 * - If > 0: places at the specified 1-based index.
 *
 * @template T - The type of the entities, must have an identifier and an index property.
 * @param entities - The current list of entities.
 * @param entityToUpsert - The entity to insert or update. If null, only re-indexes existing entities (e.g., after a delete).
 * @param entityIdSelector - Function to select the ID of an entity.
 * @param entityIndexSelector - Function to select the current index of an entity. Should return number | undefined | null.
 * @param entityIndexMutator - Function to set the new index on an entity and return the mutated entity.
 * @returns A new array with entities in their correct order and with updated indices.
 */
export function insertAndNormalizeOrder<T>(
  entities: T[],
  entityToUpsert: T | null,
  entityIdSelector: (e: T) => string,
  entityIndexSelector: (e: T) => number | undefined | null,
  entityIndexMutator: (e: T, index: number) => T,
): T[] {
  const items = [...entities];
  const entityToUpsertId = entityToUpsert ? entityIdSelector(entityToUpsert) : null;

  // Remove the entity if it exists to handle updates or moves
  const existingEntityIndexInOriginalItems = entityToUpsertId
    ? items.findIndex((e) => entityIdSelector(e) === entityToUpsertId)
    : -1;

  if (existingEntityIndexInOriginalItems !== -1) {
    items.splice(existingEntityIndexInOriginalItems, 1);
  }

  // Add or re-insert the entity at the specified position
  if (entityToUpsert) {
    const desiredIndexValue = entityIndexSelector(entityToUpsert);

    if (desiredIndexValue === undefined || desiredIndexValue === null) {
      // Case 1: Append to the end
      items.push(entityToUpsert);
    } else if (desiredIndexValue <= 0) {
      // Case 2: Place at the beginning (splice at index 0)
      items.splice(0, 0, entityToUpsert);
    } else {
      // Case 3: Place at specific 1-based index (desiredIndexValue > 0)
      // Ensure desiredIndexValue is within bounds for 1-based indexing for splice (0-based)
      const targetSpliceIndex = Math.max(0, Math.min(desiredIndexValue - 1, items.length));
      items.splice(targetSpliceIndex, 0, entityToUpsert);
    }
  }

  // Normalize indices
  return items.map((item, idx) => {
    const currentItemIndex = entityIndexSelector(item);
    const expectedItemIndex = idx + 1; // 1-based indexing

    // Mutate if the index is incorrect, or if it is the entity that was upserted (to ensure its index is correctly set based on its new position)
    if (currentItemIndex !== expectedItemIndex || (entityToUpsertId && entityIdSelector(item) === entityToUpsertId)) {
      return entityIndexMutator(item, expectedItemIndex);
    }
    return item;
  });
}
