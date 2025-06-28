/**
 * Groups an array of objects by a specified key.
 *
 * @template T - The type of objects in the array.
 * @template K - The key of the object to group by.
 * @param {T[]} array - The array of objects to group.
 * @param {K} key - The key to group the objects by.
 * @returns {Record<string, T[]>} An object where keys are the grouped values and values are arrays of objects belonging to that group.
 */
export const groupBy = <T, K extends keyof T>(array: T[], key: K): Record<string, T[]> => {
  return array.reduce((acc, obj) => {
    const groupKey = String(obj[key]);
    if (!acc[groupKey]) {
      acc[groupKey] = [];
    }
    acc[groupKey].push(obj);
    return acc;
  }, {} as Record<string, T[]>);
};
