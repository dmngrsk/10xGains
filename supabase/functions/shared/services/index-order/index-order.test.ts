import { describe, it, expect } from 'vitest';
import { insertAndNormalizeOrder } from './index-order.ts';

interface TestEntity {
  id: string;
  name: string;
  order: number | undefined | null;
  otherProp?: string;
}

const idSelector = (e: TestEntity) => e.id;
const indexSelector = (e: TestEntity): number | undefined | null => e.order;
const indexMutator = (e: TestEntity, newIndex: number): TestEntity => ({ ...e, order: newIndex });
const indexMutatorWithSideEffect = (e: TestEntity, newIndex: number): TestEntity => {
  return { ...e, order: newIndex, otherProp: 'mutated' };
};

describe('insertAndNormalizeOrder', () => {

  describe('adding new item to an empty list', () => {
    interface EmptyListTestCase {
      description: string;
      initialOrder: number | undefined | null;
      expectedFinalOrder: number;
    }
    const testCases: EmptyListTestCase[] = [
      { description: 'specific index 1', initialOrder: 1, expectedFinalOrder: 1 },
      { description: 'order undefined (append)', initialOrder: undefined, expectedFinalOrder: 1 },
      { description: 'order null (append)', initialOrder: null, expectedFinalOrder: 1 },
      { description: 'order 0 (prepend)', initialOrder: 0, expectedFinalOrder: 1 },
      { description: 'order -1 (prepend)', initialOrder: -1, expectedFinalOrder: 1 },
    ];

    it.each(testCases)('should correctly add item when order is $description', ({ initialOrder, expectedFinalOrder }: EmptyListTestCase) => {
      const entities: TestEntity[] = [];
      const newItem: TestEntity = { id: '1', name: 'A', order: initialOrder };
      const result = insertAndNormalizeOrder(entities, newItem, idSelector, indexSelector, indexMutator);
      expect(result.length).toBe(1);
      expect(result[0]).toEqual({ ...newItem, order: expectedFinalOrder });
    });
  });

  describe('adding new item to a list with one existing item', () => {
    const existingItem: TestEntity = { id: '1', name: 'A', order: 1 };
    interface SingleItemAddTestCase {
      description: string;
      initialOrder: number | undefined | null;
      newItemId: string;
      newItemName: string;
      expectedOrderNew: number;
      expectedOrderOld: number;
    }
    const testCases: SingleItemAddTestCase[] = [
      { description: 'undefined (append)', initialOrder: undefined, newItemId: '2', newItemName: 'B', expectedOrderNew: 2, expectedOrderOld: 1 },
      { description: 'null (append)', initialOrder: null, newItemId: '2', newItemName: 'B', expectedOrderNew: 2, expectedOrderOld: 1 },
      { description: '0 (prepend)', initialOrder: 0, newItemId: '2', newItemName: 'B', expectedOrderNew: 1, expectedOrderOld: 2 },
      { description: '-5 (prepend)', initialOrder: -5, newItemId: '2', newItemName: 'B', expectedOrderNew: 1, expectedOrderOld: 2 },
      { description: '2 (specific position, becomes 2nd)', initialOrder: 2, newItemId: '2', newItemName: 'B', expectedOrderNew: 2, expectedOrderOld: 1 },
    ];

    it.each(testCases)(
      'should correctly add item with order $description, resulting in new order $expectedOrderNew and old $expectedOrderOld',
      ({ initialOrder, newItemId, newItemName, expectedOrderNew, expectedOrderOld }: SingleItemAddTestCase) => {
        const entities: TestEntity[] = [{...existingItem}];
        const newItem: TestEntity = { id: newItemId, name: newItemName, order: initialOrder };
        const result = insertAndNormalizeOrder(entities, newItem, idSelector, indexSelector, indexMutator);

        expect(result.length).toBe(2);
        expect(result.find((e: TestEntity) => e.id === newItemId)?.name).toBe(newItemName);
        expect(result.find((e: TestEntity) => e.id === newItemId)?.order).toBe(expectedOrderNew);
        expect(result.find((e: TestEntity) => e.id === existingItem.id)?.order).toBe(expectedOrderOld);
      }
    );
  });

  it('should correctly add a new item at a specific index (from item.order) and re-index others', () => {
    const entities: TestEntity[] = [
      { id: '1', name: 'A', order: 1 },
      { id: '2', name: 'B', order: 2 },
    ];
    const newItem: TestEntity = { id: '3', name: 'C', order: 1 };
    const result = insertAndNormalizeOrder(entities, newItem, idSelector, indexSelector, indexMutator);
    expect(result.length).toBe(3);
    expect(result[0]).toEqual({ ...newItem, order: 1 });
    expect(result[1]).toEqual({ ...entities[0], order: 2 });
    expect(result[2]).toEqual({ ...entities[1], order: 3 });
  });

  it('should correctly update an existing item\'s index (from item.order to <=0 means prepend) and re-index others', () => {
    const entities: TestEntity[] = [
      { id: '1', name: 'A', order: 1 },
      { id: '2', name: 'B', order: 2 },
      { id: '3', name: 'C', order: 3 },
    ];
    const itemToUpdate: TestEntity = { id: '3', name: 'C (updated)', order: 0 };
    const result = insertAndNormalizeOrder(entities, itemToUpdate, idSelector, indexSelector, indexMutator);
    expect(result.length).toBe(3);
    expect(result.find((e: TestEntity) => e.id === '3')?.order).toBe(1);
    expect(result.find((e: TestEntity) => e.id === '3')?.name).toBe('C (updated)');
    expect(result.find((e: TestEntity) => e.id === '1')?.order).toBe(2);
    expect(result.find((e: TestEntity) => e.id === '2')?.order).toBe(3);
  });

  it('should correctly update an existing item\'s index (from item.order to >0) and re-index others', () => {
    const entities: TestEntity[] = [
      { id: '1', name: 'A', order: 1 },
      { id: '2', name: 'B', order: 2 },
      { id: '3', name: 'C', order: 3 },
    ];
    const itemToUpdate: TestEntity = { id: '1', name: 'A (updated)', order: 3 };
    const result = insertAndNormalizeOrder(entities, itemToUpdate, idSelector, indexSelector, indexMutator);
    expect(result.length).toBe(3);
    expect(result.find((e: TestEntity) => e.id === '2')?.order).toBe(1);
    expect(result.find((e: TestEntity) => e.id === '3')?.order).toBe(2);
    expect(result.find((e: TestEntity) => e.id === '1')?.order).toBe(3);
    expect(result.find((e: TestEntity) => e.id === '1')?.name).toBe('A (updated)');
  });

  it('should correctly re-index after removing an item (entityToUpsert is null)', () => {
    const entitiesBeforeRemoval: TestEntity[] = [
      { id: '1', name: 'A', order: 1 },
      { id: '2', name: 'B', order: 2 },
      { id: '3', name: 'C', order: 3 },
    ];
    const remainingEntities = [entitiesBeforeRemoval[0], entitiesBeforeRemoval[2]];
    const result = insertAndNormalizeOrder(remainingEntities, null, idSelector, indexSelector, indexMutator);
    expect(result.length).toBe(2);
    expect(result.find((e: TestEntity) => e.id === '1')?.order).toBe(1);
    expect(result.find((e: TestEntity) => e.id === '3')?.order).toBe(2);
  });

  it('should handle inserting with an item.order out of bounds (too high) - effectively places at target or appends', () => {
    const entities: TestEntity[] = [{ id: '1', name: 'A', order: 1 }];
    const newItem: TestEntity = { id: 'new', name: 'New', order: 5 };
    const result = insertAndNormalizeOrder(entities, newItem, idSelector, indexSelector, indexMutator);
    expect(result.length).toBe(2);
    expect(result.find((e: TestEntity) => e.id === '1')?.order).toBe(1);
    expect(result.find((e: TestEntity) => e.id === 'new')?.order).toBe(2);
  });

  it('mutator function should only change the index', () => {
    const originalEntity: TestEntity = { id: '1', name: 'A', order: 1, otherProp: 'original' };
    const entities: TestEntity[] = [originalEntity];
    const itemToUpdate: TestEntity = { ...originalEntity, order: 1 };

    const result = insertAndNormalizeOrder(entities, itemToUpdate, idSelector, indexSelector, indexMutator);
    expect(result.length).toBe(1);
    expect(result[0].id).toBe('1');
    expect(result[0].name).toBe('A');
    expect(result[0].order).toBe(1);
    expect(result[0].otherProp).toBe('original');

    const resultWithSideEffect = insertAndNormalizeOrder(entities, itemToUpdate, idSelector, indexSelector, indexMutatorWithSideEffect);
    expect(resultWithSideEffect[0].otherProp).toBe('mutated');
    expect(resultWithSideEffect[0].otherProp).not.toBe(originalEntity.otherProp);
  });

  it('should return new array instances and new entity instances for mutated items', () => {
    const entity1: TestEntity = { id: '1', name: 'A', order: 1 };
    const entity2: TestEntity = { id: '2', name: 'B', order: 2 };
    const entities: TestEntity[] = [entity1, entity2];
    const newItem: TestEntity = { id: '3', name: 'C', order: 1 };

    const result = insertAndNormalizeOrder(entities, newItem, idSelector, indexSelector, indexMutator);

    expect(result).not.toBe(entities);
    expect(result.length).toBe(3);

    const resultNewItem = result.find((e: TestEntity) => e.id === '3');
    expect(resultNewItem).not.toBe(newItem);
    expect(resultNewItem?.order).toBe(1);

    const resultEntity1 = result.find((e: TestEntity) => e.id === '1');
    expect(resultEntity1).not.toBe(entity1);
    expect(resultEntity1?.order).toBe(2);

    const resultEntity2 = result.find((e: TestEntity) => e.id === '2');
    expect(resultEntity2).not.toBe(entity2);
    expect(resultEntity2?.order).toBe(3);
  });

  it('should not mutate items if their index is already correct and they are not the upserted item', () => {
    const entity1: TestEntity = { id: '1', name: 'A', order: 1 };
    const entity2: TestEntity = { id: '2', name: 'B', order: 2 };
    const entity3: TestEntity = { id: '3', name: 'C', order: 3 };
    const entities: TestEntity[] = [entity1, entity2, entity3];
    const itemToMove: TestEntity = { ...entity1, order: 3 };

    const result = insertAndNormalizeOrder(entities, itemToMove, idSelector, indexSelector, indexMutator);
    expect(result.length).toBe(3);

    const finalItem1 = result.find((e: TestEntity) => e.id === '1');
    const finalItem2 = result.find((e: TestEntity) => e.id === '2');
    const finalItem3 = result.find((e: TestEntity) => e.id === '3');

    expect(finalItem1?.order).toBe(3);
    expect(finalItem2?.order).toBe(1);
    expect(finalItem3?.order).toBe(2);

    expect(finalItem1).not.toBe(entity1);
    expect(finalItem2).not.toBe(entity2);
    expect(finalItem3).not.toBe(entity3);
  });

  it('updating an item without changing its actual position, but its content changes', () => {
    const entity1: TestEntity = { id: '1', name: 'A', order: 1, otherProp: 'v1' };
    const entity2: TestEntity = { id: '2', name: 'B', order: 2, otherProp: 'v2' };
    const entities: TestEntity[] = [entity1, entity2];
    const updatedEntity1: TestEntity = { ...entity1, name: 'A Updated', order: 1 };

    const result = insertAndNormalizeOrder(entities, updatedEntity1, idSelector, indexSelector, indexMutator);

    expect(result.length).toBe(2);
    const finalUpdatedEntity1 = result.find((e: TestEntity) => e.id === '1');
    const finalEntity2 = result.find((e: TestEntity) => e.id === '2');

    expect(finalUpdatedEntity1).not.toBe(entity1);
    expect(finalUpdatedEntity1?.name).toBe('A Updated');
    expect(finalUpdatedEntity1?.order).toBe(1);
    expect(finalUpdatedEntity1?.otherProp).toBe('v1');

    expect(finalEntity2).toBe(entity2);
    expect(finalEntity2?.order).toBe(2);
  });
});
