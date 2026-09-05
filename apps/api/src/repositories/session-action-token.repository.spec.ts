import { describe, expect, it } from 'vitest';
import { ACTION_TOKEN_TTL_MS, hashToken } from './session-action-token.repository';

describe('session action tokens', () => {
  describe('hashToken', () => {
    /**
     * The API mints and hashes in Node; `complete_session_set_with_action_token` hashes the token it
     * is given in SQL. Nothing works if the two digests disagree, and no other test would say why,
     * so this pins the value Postgres produces for
     * `encode(sha256(convert_to('valid-token','UTF8')),'hex')`.
     */
    it('should match the digest Postgres computes for the same token', () => {
      expect(hashToken('valid-token')).toBe('397a2a9c5bf5e2ccec38c2596b682bb1bd05fe6e4ecea6c10cf42755ff225403');
    });

    it('should produce a 64 character hex digest', () => {
      expect(hashToken('any-token')).toMatch(/^[0-9a-f]{64}$/);
    });

    it('should be stable for the same token', () => {
      expect(hashToken('repeatable')).toBe(hashToken('repeatable'));
    });
  });

  describe('ACTION_TOKEN_TTL_MS', () => {
    // The database enforces the same ceiling with a check constraint, so a longer value here would
    // not mint a longer-lived token - it would fail every insert.
    it('should not exceed the twelve hour ceiling the schema enforces', () => {
      expect(ACTION_TOKEN_TTL_MS).toBeLessThanOrEqual(12 * 60 * 60 * 1000);
    });
  });
});
