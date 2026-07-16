import { z } from 'zod';
import { describe, it, expect } from 'vitest';
import { optionalCsvList, optionalIsoDate, optionalLimit, optionalOffset, optionalSort, withCoherentDateRange, withCompletedAtConsistency } from './validation';

const UUID_A = '1f6a2c3e-9b4d-4e8f-a1b2-c3d4e5f6a7b8';
const UUID_B = '2a7b3d4f-0c5e-4f9a-b2c3-d4e5f6a7b8c9';

describe('optionalLimit', () => {
  const schema = z.object({ limit: optionalLimit() });

  it('should parse a numeric page size', () => {
    expect(schema.parse({ limit: '25' }).limit).toBe(25);
  });

  it.each([undefined, ''])('should fall back to the default for %p', (value) => {
    expect(schema.parse({ limit: value }).limit).toBe(20);
  });

  it('should honour a custom default and maximum', () => {
    const custom = z.object({ limit: optionalLimit(5, 10) });

    expect(custom.parse({}).limit).toBe(5);
    expect(custom.safeParse({ limit: '11' }).success).toBe(false);
  });

  it('should allow a limit of zero, which asks for the count without any rows', () => {
    expect(schema.parse({ limit: '0' }).limit).toBe(0);
  });

  it.each(['-1', '101', '1.5'])('should reject %p', (value) => {
    expect(schema.safeParse({ limit: value }).success).toBe(false);
  });

  it('should reject a partly numeric value rather than truncating it', () => {
    expect(schema.safeParse({ limit: '12abc' }).success).toBe(false);
  });
});

describe('optionalOffset', () => {
  const schema = z.object({ offset: optionalOffset() });

  it('should parse a numeric offset', () => {
    expect(schema.parse({ offset: '40' }).offset).toBe(40);
  });

  it('should allow an offset of zero', () => {
    expect(schema.parse({ offset: '0' }).offset).toBe(0);
  });

  it.each([undefined, ''])('should fall back to zero for %p', (value) => {
    expect(schema.parse({ offset: value }).offset).toBe(0);
  });

  it.each(['-1', 'abc'])('should reject %p', (value) => {
    expect(schema.safeParse({ offset: value }).success).toBe(false);
  });
});

describe('optionalSort', () => {
  const schema = z.object({ sort: optionalSort('session_date', 'asc') });

  it('should accept a well-formed sort expression', () => {
    expect(schema.parse({ sort: 'created_at.desc' }).sort).toBe('created_at.desc');
  });

  it.each([undefined, ''])('should fall back to the default column and direction for %p', (value) => {
    expect(schema.parse({ sort: value }).sort).toBe('session_date.asc');
  });

  it('should support a descending default', () => {
    const descending = z.object({ sort: optionalSort('created_at', 'desc') });

    expect(descending.parse({}).sort).toBe('created_at.desc');
  });

  it.each(['created_at', 'created_at.sideways', 'created_at.asc.desc', '1nvalid.asc'])(
    'should reject %p',
    (value) => {
      expect(schema.safeParse({ sort: value }).success).toBe(false);
    }
  );
});

describe('optionalIsoDate', () => {
  const schema = z.object({ date: optionalIsoDate() });

  it('should accept a full ISO datetime unchanged', () => {
    const result = schema.safeParse({ date: '2026-07-13T10:00:00.000Z' });

    expect(result.success).toBe(true);
    expect(result.data!.date).toBe('2026-07-13T10:00:00.000Z');
  });

  it('should widen a date-only value into a datetime', () => {
    const result = schema.safeParse({ date: '2026-04-13' });

    expect(result.success).toBe(true);
    expect(result.data!.date).toBe(new Date('2026-04-13').toISOString());
  });

  it.each([undefined, null, ''])('should treat %p as not provided', (value) => {
    const result = schema.safeParse({ date: value });

    expect(result.success).toBe(true);
    expect(result.data!.date).toBeUndefined();
  });

  it.each(['not-a-date', '2026-13-45', 'null'])('should reject %p without throwing', (value) => {
    let result: ReturnType<typeof schema.safeParse>;

    expect(() => { result = schema.safeParse({ date: value }); }).not.toThrow();
    expect(result!.success).toBe(false);
  });
});

describe('optionalCsvList', () => {
  const schema = z.object({ ids: optionalCsvList(z.string().uuid()) });

  it('should split a comma-separated list into validated items', () => {
    const result = schema.safeParse({ ids: `${UUID_A},${UUID_B}` });

    expect(result.success).toBe(true);
    expect(result.data!.ids).toEqual([UUID_A, UUID_B]);
  });

  it('should accept a single item', () => {
    const result = schema.safeParse({ ids: UUID_A });

    expect(result.success).toBe(true);
    expect(result.data!.ids).toEqual([UUID_A]);
  });

  it('should trim whitespace around items', () => {
    const result = schema.safeParse({ ids: ` ${UUID_A} , ${UUID_B} ` });

    expect(result.success).toBe(true);
    expect(result.data!.ids).toEqual([UUID_A, UUID_B]);
  });

  it('should drop blank entries left by a trailing comma', () => {
    const result = schema.safeParse({ ids: `${UUID_A},` });

    expect(result.success).toBe(true);
    expect(result.data!.ids).toEqual([UUID_A]);
  });

  it.each([undefined, ''])('should treat %p as not provided rather than an empty list', (value) => {
    const result = schema.safeParse({ ids: value });

    expect(result.success).toBe(true);
    expect(result.data!.ids).toBeUndefined();
  });

  it('should reject a list containing an item that fails the item schema', () => {
    const result = schema.safeParse({ ids: `${UUID_A},oops` });

    expect(result.success).toBe(false);
  });

  it('should validate against the given item schema, not just strings', () => {
    const statusSchema = z.object({ status: optionalCsvList(z.enum(['PENDING', 'COMPLETED'])) });

    expect(statusSchema.safeParse({ status: 'PENDING,COMPLETED' }).success).toBe(true);
    expect(statusSchema.safeParse({ status: 'PENDING,NOPE' }).success).toBe(false);
  });
});

describe('withCoherentDateRange', () => {
  const schema = withCoherentDateRange(z.object({
    date_from: optionalIsoDate(),
    date_to: optionalIsoDate(),
  }));

  it('should accept a range whose start precedes its end', () => {
    const result = schema.safeParse({ date_from: '2026-01-01', date_to: '2026-02-01' });

    expect(result.success).toBe(true);
  });

  it('should accept a range whose start equals its end', () => {
    const result = schema.safeParse({ date_from: '2026-01-01T00:00:00.000Z', date_to: '2026-01-01T00:00:00.000Z' });

    expect(result.success).toBe(true);
  });

  it.each([
    { date_from: '2026-01-01' },
    { date_to: '2026-01-01' },
    {},
  ])('should accept an open-ended range for %p', (params) => {
    expect(schema.safeParse(params).success).toBe(true);
  });

  it('should reject a range whose start comes after its end', () => {
    const result = schema.safeParse({ date_from: '2026-02-01', date_to: '2026-01-01' });

    expect(result.success).toBe(false);
    expect(result.error!.flatten().fieldErrors['date_from']).toBeDefined();
  });
});

describe('withCompletedAtConsistency', () => {
  const schema = withCompletedAtConsistency(z.object({
    status: z.enum(['PENDING', 'COMPLETED', 'FAILED', 'SKIPPED']).optional(),
    completed_at: z.string().datetime().nullable().optional(),
  }));

  const COMPLETED_AT = '2026-07-16T10:00:00.000Z';

  it.each(['COMPLETED', 'FAILED'])('should accept %s when a completion timestamp is supplied', (status) => {
    expect(schema.safeParse({ status, completed_at: COMPLETED_AT }).success).toBe(true);
  });

  it.each(['COMPLETED', 'FAILED'])('should reject %s without a completion timestamp', (status) => {
    const result = schema.safeParse({ status });

    expect(result.success).toBe(false);
    expect(result.error!.flatten().fieldErrors['completed_at']).toContain(
      'completed_at is required if status is COMPLETED or FAILED.'
    );
  });

  it.each([null, undefined])('should reject a terminal status whose timestamp is %p', (completedAt) => {
    expect(schema.safeParse({ status: 'COMPLETED', completed_at: completedAt }).success).toBe(false);
  });

  it.each(['PENDING', 'SKIPPED'])('should accept %s with no completion timestamp', (status) => {
    expect(schema.safeParse({ status }).success).toBe(true);
  });

  it.each(['PENDING', 'SKIPPED'])('should reject %s carrying a completion timestamp', (status) => {
    const result = schema.safeParse({ status, completed_at: COMPLETED_AT });

    expect(result.success).toBe(false);
    expect(result.error!.flatten().fieldErrors['completed_at']).toContain(
      'completed_at should only be provided if status is COMPLETED or FAILED.'
    );
  });

  it('should reject a timestamp when the status is absent, since absent is not terminal', () => {
    expect(schema.safeParse({ completed_at: COMPLETED_AT }).success).toBe(false);
  });

  it('should accept an empty command, leaving the fields to the other rules', () => {
    expect(schema.safeParse({}).success).toBe(true);
  });
});
