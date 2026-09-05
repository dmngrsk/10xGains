import { createHash, randomBytes } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { CompleteSessionSetWithTokenResponseDto, Database, SessionActionTokenDto } from '@txg/shared';
import { ConflictError, NotFoundError, UnauthorizedError } from '../utils/errors';

/**
 * How long a minted token stays spendable. It has to outlive a long workout, since the notification
 * it travels in is only useful while the session is open; the database enforces the same ceiling, so
 * this cannot drift into minting something long-lived.
 */
export const ACTION_TOKEN_TTL_MS = 12 * 60 * 60 * 1000;

/** 32 bytes of entropy, url-safe so it survives being embedded in a notification payload. */
const TOKEN_BYTES = 32;

/**
 * Issues and spends session action tokens.
 *
 * The two halves run under different callers by design: minting happens with the user's JWT while
 * the app is open, and spending happens from a service worker with no session at all. Only `mint`
 * touches `getUserId`, so `consume` stays callable on an unauthenticated request.
 */
export class SessionActionTokenRepository {
  constructor(
    private supabase: SupabaseClient<Database>,
    private getUserId: () => string
  ) {}

  /**
   * Mints a token for a session the caller owns, revoking any it already has for that session.
   *
   * One live token per session keeps a stale notification from staying spendable after a newer one
   * replaced it, and bounds how many credentials exist for a workout to exactly one.
   *
   * @param {string} sessionId - The session the token may complete sets in.
   * @returns {Promise<SessionActionTokenDto>} The raw token and its expiry. The token is not
   *   recoverable afterwards; only its hash is stored.
   */
  async mint(sessionId: string): Promise<SessionActionTokenDto> {
    const userId = this.getUserId();

    // RLS scopes this to the caller's own sessions, so a missing row is "not found or not yours".
    // The token would be inert against someone else's session anyway - the database resolves
    // ownership from the token row - but there is no reason to store a row that can never be spent.
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
   * Completes a set using a token rather than a user session.
   *
   * The token is passed through untouched: the database hashes it and resolves the owning user from
   * the stored row, so nothing here needs - or is trusted with - an identity.
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
   * A token that is unknown, expired, revoked, or bound to a session its owner cannot reach are all
   * the same answer to the caller: the credential does not work. Only a set that genuinely does not
   * exist, and a session that has since been completed, are distinguished - the caller needs those
   * to stop retrying and take the notification down.
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
