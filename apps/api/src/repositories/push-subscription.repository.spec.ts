import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, PushSubscriptionDto } from '@txg/shared';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PushSubscriptionRepository } from './push-subscription.repository';

const USER_ID = 'user-1';

describe('PushSubscriptionRepository', () => {
  let repository: PushSubscriptionRepository;
  let from: ReturnType<typeof vi.fn>;
  let upsert: ReturnType<typeof vi.fn>;
  let select: ReturnType<typeof vi.fn>;
  let single: ReturnType<typeof vi.fn>;
  let del: ReturnType<typeof vi.fn>;
  let eq1: ReturnType<typeof vi.fn>;
  let eq2: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    single = vi.fn();
    select = vi.fn(() => ({ single }));
    upsert = vi.fn(() => ({ select }));

    eq2 = vi.fn();
    eq1 = vi.fn(() => ({ eq: eq2 }));
    del = vi.fn(() => ({ eq: eq1 }));

    from = vi.fn(() => ({ upsert, delete: del }));

    const supabase = { from } as unknown as SupabaseClient<Database>;
    repository = new PushSubscriptionRepository(supabase, () => USER_ID);
  });

  it('upserts the subscription mapped to columns, keyed on endpoint', async () => {
    const row = { id: 's1', user_id: USER_ID, endpoint: 'https://push/1', p256dh: 'p', auth: 'a', created_at: 't' } as PushSubscriptionDto;
    single.mockResolvedValue({ data: row, error: null });

    const result = await repository.upsert({ endpoint: 'https://push/1', keys: { p256dh: 'p', auth: 'a' } });

    expect(from).toHaveBeenCalledWith('push_subscriptions');
    expect(upsert).toHaveBeenCalledWith(
      { user_id: USER_ID, endpoint: 'https://push/1', p256dh: 'p', auth: 'a' },
      { onConflict: 'endpoint' },
    );
    expect(result).toBe(row);
  });

  it('throws when the upsert fails', async () => {
    single.mockResolvedValue({ data: null, error: new Error('db down') });
    await expect(repository.upsert({ endpoint: 'https://push/1', keys: { p256dh: 'p', auth: 'a' } })).rejects.toThrow('db down');
  });

  it('deletes by endpoint scoped to the current user', async () => {
    eq2.mockResolvedValue({ error: null });

    await repository.deleteByEndpoint('https://push/1');

    expect(del).toHaveBeenCalled();
    expect(eq1).toHaveBeenCalledWith('user_id', USER_ID);
    expect(eq2).toHaveBeenCalledWith('endpoint', 'https://push/1');
  });
});
