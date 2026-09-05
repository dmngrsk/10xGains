import { createHash, randomBytes } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { CompleteSessionSetWithTokenResponseDto, Database, SessionActionTokenDto } from '@txg/shared';
import { ConflictError, NotFoundError, UnauthorizedError } from '../utils/errors';

/** How long a minted token stays spendable. The schema enforces the same ceiling. */
export const ACTION_TOKEN_TTL_MS = 12 * 60 * 60 * 1000;

/** 32 bytes of entropy, url-safe so it survives being embedded in a notification payload. */
const TOKEN_BYTES = 32;

/**
 * Issues and spends session action tokens.
 *
 * Minting happens with the user's JWT while the app is open; spending happens from a service worker
 * with no session at all. Only `mint` touches `getUserId`, so `consume` stays callable unauthenticated.
 */
export class SessionActionTokenRepository {
  constructor(
    private supabase: SupabaseClient<Database>,
    private getUserId: () => string
  ) {}

  /**
   * Mints a token for a session the caller owns, revoking any it already has for that session, so a
   * notification replaced by a newer one does not stay spendable.
   *
   * @param {string} sessionId - The session the token may complete sets in.
   * @returns {Promise<SessionActionTokenDto>} The raw token and its expiry. The token is not
   *   recoverable afterwards; only its hash is stored.
   */
  async mint(sessionId: string): Promise<SessionActionTokenDto> {
    const userId = this.getUserId();

    // RLS scopes this to the caller's own sessions. A token is inert against someone else's session
    // anyway, but there is no reason to store a row that can never be spent.
    const { data: session, error: sessionError } = await this.supabase
      .from('sessions')
      .select('id')
      .eq('id', sessionId)
      .maybeSingle();

    if (sessionError) {
      throw new Error(sessionError.message);
    }

    if (!session) {
      throw new NotFoundError('Session not found.', 'SESSION_NOT_FOUND', 'session_not_found_error');
    }

    const { error: revokeError } = await this.supabase
      .from('session_action_tokens')
      .update({ revoked_at: new Date().toISOString() })
      .eq('session_id', sessionId)
      .is('revoked_at', null);

    if (revokeError) {
      throw new Error(revokeError.message);
    }

    const token = randomBytes(TOKEN_BYTES).toString('base64url');
    const expiresAt = new Date(Date.now() + ACTION_TOKEN_TTL_MS).toISOString();

    const { error: insertError } = await this.supabase
      .from('session_action_tokens')
      .insert({
        user_id: userId,
        session_id: sessionId,
        token_hash: hashToken(token),
        expires_at: expiresAt,
      });

    if (insertError) {
      throw new Error(insertError.message);
    }

    return { token, expires_at: expiresAt };
  }

  /**
   * Completes a set using a token rather than a user session. The token is passed through untouched:
   * the database hashes it and resolves the owning user from the stored row.
   *
   * @param {string} token - The raw token, as minted.
   * @param {string} sessionId - The session the token was minted for.
   * @param {string} setId - The set to complete.
   * @returns {Promise<CompleteSessionSetWithTokenResponseDto>} The updated set, the next set still
   *   pending, and the session's resulting status.
   */
  async consume(token: string, sessionId: string, setId: string): Promise<CompleteSessionSetWithTokenResponseDto> {
    const { data, error } = await this.supabase.rpc('complete_session_set_with_action_token', {
      p_token: token,
      p_session_id: sessionId,
      p_set_id: setId,
    });

    if (error) {
      throw this.toConsumeError(error.message);
    }

    return data as unknown as CompleteSessionSetWithTokenResponseDto;
  }

  /**
   * Translates the sentinel conditions raised by `complete_session_set_with_action_token`.
   *
   * Every way of holding a bad token collapses to the same 401, so it reveals nothing. A missing set
   * and an already-completed session stay distinct: the caller needs those to stop retrying.
   *
   * @param {string} message - The message from the Postgres error.
   * @returns {Error} The domain error to throw, or the original condition if it is unrecognised.
   */
  private toConsumeError(message: string): Error {
    if (message.includes('ACTION_TOKEN_INVALID') || message.includes('SESSION_NOT_FOUND')) {
      return new UnauthorizedError('Session action token is not valid.', 'ACTION_TOKEN_INVALID', 'action_token_error');
    }

    if (message.includes('SESSION_SET_NOT_FOUND')) {
      return new NotFoundError('Session set not found.', 'SESSION_SET_NOT_FOUND', 'session_set_not_found_error');
    }

    if (message.includes('SESSION_COMPLETED')) {
      return new ConflictError('Session is completed. Cannot update set.', 'SESSION_COMPLETED', 'session_completed_error', 409);
    }

    return new Error(message);
  }
}

/** SHA-256, hex encoded - the same digest `complete_session_set_with_action_token` computes. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}
